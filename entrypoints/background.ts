import { browser } from 'wxt/browser';

const MENU_TEXT_ID = 'side-stash-save-text';
const MENU_LINK_ID = 'side-stash-save-link';
const MENU_IMAGE_ID = 'side-stash-save-image';
const STORAGE_KEY = 'items';

type ContextData = {
  pageTitle: string;
  linkText: string;
  linkUrl: string;
  imageAlt: string;
  imageUrl: string;
};

const t = (key: string, fallback: string, substitutions?: string | string[]) =>
  browser.i18n.getMessage(key, substitutions) || fallback;

const createMenus = () => {
  browser.contextMenus.create({
    id: MENU_TEXT_ID,
    title: t('menuSaveText', 'Save text to side panel'),
    contexts: ['selection'],
  });

  browser.contextMenus.create({
    id: MENU_LINK_ID,
    title: t('menuSaveLink', 'Save link to side panel'),
    contexts: ['link'],
  });

  browser.contextMenus.create({
    id: MENU_IMAGE_ID,
    title: t('menuSaveImage', 'Save image to side panel'),
    contexts: ['image'],
  });
};

const refreshMenus = async () => {
  try {
    await browser.contextMenus.removeAll();
  } catch {
    // ignore
  }
  createMenus();
};

const setPanelBehavior = () => {
  const sidePanel = (
    browser as typeof browser & {
      sidePanel?: { setPanelBehavior: (options: { openPanelOnActionClick: boolean }) => Promise<void> };
    }
  ).sidePanel;

  if (sidePanel?.setPanelBehavior) {
    sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  }
};

const getContextData = async (tabId?: number): Promise<ContextData | null> => {
  if (typeof tabId !== 'number') {
    return null;
  }

  try {
    const data = await browser.tabs.sendMessage(tabId, {
      type: 'side-stash-get-context',
    });
    return (data as ContextData) ?? null;
  } catch {
    return null;
  }
};

const buildId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getImageLabel = (imageUrl: string, imageAlt: string) => {
  if (imageAlt) {
    return imageAlt;
  }
  try {
    const url = new URL(imageUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const filename = parts[parts.length - 1];
    if (filename) {
      return decodeURIComponent(filename);
    }
  } catch {
    // ignore invalid url
  }
  return imageUrl;
};

const addItem = async (item: Record<string, unknown>) => {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const items = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
  items.unshift(item);
  await browser.storage.local.set({ [STORAGE_KEY]: items });
};

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void refreshMenus();
    setPanelBehavior();
  });

  browser.runtime.onStartup.addListener(() => {
    void refreshMenus();
    setPanelBehavior();
  });


  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    const contextData = await getContextData(tab?.id);
    const pageTitle = contextData?.pageTitle || '';
    const pageUrl = info.pageUrl || tab?.url || '';
    const createdAt = new Date().toISOString();

    if (info.menuItemId === MENU_TEXT_ID) {
      const selectedText = (info.selectionText || '').trim();
      if (!selectedText) {
        return;
      }

      await addItem({
        id: buildId(),
        type: 'text',
        content: selectedText,
        pageTitle,
        pageUrl,
        createdAt,
      });

      return;
    }

    if (info.menuItemId === MENU_LINK_ID) {
      const linkUrl = info.linkUrl || contextData?.linkUrl || '';
      if (!linkUrl) {
        return;
      }

      const linkText =
        (contextData?.linkText || '').trim() || info.selectionText || linkUrl;

      await addItem({
        id: buildId(),
        type: 'link',
        content: linkText,
        linkUrl,
        pageTitle,
        pageUrl,
        createdAt,
      });

      return;
    }

    if (info.menuItemId === MENU_IMAGE_ID) {
      const imageUrl = info.srcUrl || contextData?.imageUrl || '';
      if (!imageUrl) {
        return;
      }

      const imageAlt = (contextData?.imageAlt || '').trim();

      await addItem({
        id: buildId(),
        type: 'image',
        content: getImageLabel(imageUrl, imageAlt),
        imageUrl,
        imageAlt,
        pageTitle,
        pageUrl,
        createdAt,
      });
    }
  });
});
