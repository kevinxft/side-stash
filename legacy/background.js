const MENU_TEXT_ID = "side-stash-save-text";
const MENU_LINK_ID = "side-stash-save-link";
const STORAGE_KEY = "items";

function createMenus() {
  chrome.contextMenus.create({
    id: MENU_TEXT_ID,
    title: "保存文本到侧边栏",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: MENU_LINK_ID,
    title: "保存链接到侧边栏",
    contexts: ["link"]
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createMenus();
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    createMenus();
  });
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

function getContextData(tabId) {
  if (typeof tabId !== "number") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "side-stash-get-context" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response || null);
    });
  });
}

function buildId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addItem(item) {
  chrome.storage.local.get({ [STORAGE_KEY]: [] }, (data) => {
    const items = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    items.unshift(item);
    chrome.storage.local.set({ [STORAGE_KEY]: items });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const contextData = await getContextData(tab?.id);
  const pageTitle = contextData?.pageTitle || "";
  const pageUrl = info.pageUrl || tab?.url || "";
  const createdAt = new Date().toISOString();

  if (info.menuItemId === MENU_TEXT_ID) {
    const selectedText = (info.selectionText || "").trim();
    if (!selectedText) {
      return;
    }

    addItem({
      id: buildId(),
      type: "text",
      content: selectedText,
      pageTitle,
      pageUrl,
      createdAt
    });

    return;
  }

  if (info.menuItemId === MENU_LINK_ID) {
    const linkUrl = info.linkUrl || contextData?.linkUrl || "";
    if (!linkUrl) {
      return;
    }

    const linkText = (contextData?.linkText || "").trim() || info.selectionText || linkUrl;

    addItem({
      id: buildId(),
      type: "link",
      content: linkText,
      linkUrl,
      pageTitle,
      pageUrl,
      createdAt
    });
  }
});
