import { browser } from 'wxt/browser';

const STORAGE_KEY = 'items';
const listEl = document.getElementById('list') as HTMLUListElement;
const emptyEl = document.getElementById('empty') as HTMLDivElement;
const countEl = document.getElementById('count') as HTMLSpanElement;
const confirmModal = document.getElementById('confirm-modal') as HTMLDivElement;
const confirmTitle = document.getElementById('confirm-title') as HTMLHeadingElement;
const confirmMessage = document.getElementById('confirm-message') as HTMLParagraphElement;
const confirmItem = document.getElementById('confirm-item') as HTMLParagraphElement;
const confirmCancel = document.getElementById('confirm-cancel') as HTMLButtonElement;
const confirmOk = document.getElementById('confirm-ok') as HTMLButtonElement;
const filterInput = document.getElementById('filter-input') as HTMLInputElement;
const filterClear = document.getElementById('filter-clear') as HTMLButtonElement;
const filterButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-filter]')
);
const selectAllButton = document.getElementById('select-all') as HTMLButtonElement;
const copyFilteredButton = document.getElementById('copy-filtered') as HTMLButtonElement;
const copyStatus = document.getElementById('copy-status') as HTMLParagraphElement;

type SavedItem = {
  id: string;
  type: 'text' | 'link' | 'image';
  content: string;
  linkUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  pageTitle?: string;
  pageUrl?: string;
  createdAt?: string;
};

let currentItems: SavedItem[] = [];
let pendingDeleteId: string | null = null;
let activeFilter: SavedItem['type'] | 'all' = 'all';
let queryText = '';
const selectedIds = new Set<string>();
let overrideMessages: Record<string, { message: string }> | null = null;

const formatTime = (iso?: string) => {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(navigator.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMessage = (message: string, substitutions?: string | string[]) => {
  if (!substitutions) {
    return message;
  }
  const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
  return subs.reduce(
    (result, value, index) =>
      result.replace(new RegExp(`\\$${index + 1}`, 'g'), value),
    message
  );
};

const t = (key: string, fallback: string, substitutions?: string | string[]) => {
  const override = overrideMessages?.[key]?.message;
  const raw = override ?? browser.i18n.getMessage(key, substitutions);
  if (override) {
    return formatMessage(override, substitutions);
  }
  return raw || fallback;
};

// Locales are handled by browser.i18n automatically.

const getItems = async (): Promise<SavedItem[]> => {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return Array.isArray(stored[STORAGE_KEY])
    ? (stored[STORAGE_KEY] as SavedItem[])
    : [];
};

const saveItems = async (items: SavedItem[]) => {
  await browser.storage.local.set({ [STORAGE_KEY]: items });
};

const setText = (id: string, key: string, fallback: string) => {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.textContent = t(key, fallback);
};

const applyI18n = () => {
  setText('panel-title', 'panelTitle', 'Side Stash');
  setText('panel-subtitle', 'panelSubtitle', 'Quickly stash text and links');
  setText('empty-title', 'emptyTitle', 'Nothing saved yet');
  setText('empty-hint', 'emptyHint', 'Right-click on a page to save text or links.');
  setText('count-label', 'countLabel', 'items');
  setText('confirm-title', 'confirmTitle', 'Delete item');
  setText('confirm-message', 'confirmDelete', 'Delete this item?');
  setText('confirm-cancel', 'confirmCancel', 'Cancel');
  setText('confirm-ok', 'actionDelete', 'Delete');
  setText('filter-all', 'filterAll', 'All');
  setText('filter-text', 'filterText', 'Text');
  setText('filter-link', 'filterLink', 'Link');
  setText('filter-image', 'filterImage', 'Image');
  setText('filter-clear', 'filterClear', 'Clear');
  setText('select-all', 'selectAll', 'Select all');
  setText('copy-filtered', 'copyFiltered', 'Copy filtered');
  setText('language-label', 'languageLabel', 'Language');
  setText('language-auto', 'languageAuto', 'Auto');
  setText('language-en', 'languageEnglish', 'English');
  setText('language-zh', 'languageChinese', 'Chinese');
  setText('language-ja', 'languageJapanese', 'Japanese');
  filterInput.placeholder = t('filterPlaceholder', 'Filter by URL or keyword');
  document.title = t('panelTitle', document.title);
};

const applyLanguage = async () => {
  overrideMessages = null;
  applyI18n();
  render(currentItems);
  setCopyStatus('');
};

const openConfirm = (item: SavedItem) => {
  pendingDeleteId = item.id;
  confirmItem.textContent = item.content;
  confirmMessage.textContent = t('confirmDelete', 'Delete this item?');
  confirmModal.hidden = false;
  confirmOk.focus();
};

const closeConfirm = () => {
  pendingDeleteId = null;
  confirmModal.hidden = true;
};

const getCopyValue = (item: SavedItem) => {
  if (item.type === 'link') {
    return item.linkUrl || item.content;
  }
  if (item.type === 'image') {
    return item.imageUrl || item.content;
  }
  return item.content;
};

const getFilteredItems = (items: SavedItem[]) =>
  items.filter((item) => {
    if (activeFilter !== 'all' && item.type !== activeFilter) {
      return false;
    }
    if (!queryText) {
      return true;
    }
    const haystack = [
      item.content,
      item.pageTitle,
      item.pageUrl,
      item.linkUrl,
      item.imageUrl,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(queryText);
  });

const updateSelectAllLabel = (filtered: SavedItem[]) => {
  if (!filtered.length) {
    selectAllButton.textContent = t('selectAll', 'Select all');
    selectAllButton.disabled = true;
    return;
  }
  selectAllButton.disabled = false;
  const allSelected = filtered.every((item) => selectedIds.has(item.id));
  selectAllButton.textContent = allSelected
    ? t('clearSelection', 'Clear selection')
    : t('selectAll', 'Select all');
};

const setCopyStatus = (message: string) => {
  copyStatus.textContent = message;
  if (!message) {
    return;
  }
  window.setTimeout(() => {
    if (copyStatus.textContent === message) {
      copyStatus.textContent = '';
    }
  }, 2000);
};

const copyTextToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
};

const buildItemElement = (item: SavedItem) => {
  const li = document.createElement('li');
  li.className = 'item';

  const header = document.createElement('div');
  header.className = 'item-header';

  const meta = document.createElement('div');
  meta.className = 'item-meta';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'item-checkbox';
  checkbox.dataset.select = 'true';
  checkbox.dataset.id = item.id;
  checkbox.checked = selectedIds.has(item.id);

  const badge = document.createElement('span');
  badge.className = 'badge';
  if (item.type === 'link') {
    badge.textContent = t('badgeLink', 'LINK');
  } else if (item.type === 'image') {
    badge.textContent = t('badgeImage', 'IMAGE');
  } else {
    badge.textContent = t('badgeText', 'TEXT');
  }

  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = formatTime(item.createdAt);

  meta.append(checkbox, badge, time);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const copyButton = document.createElement('button');
  copyButton.className = 'button ghost';
  copyButton.type = 'button';
  copyButton.textContent = t('actionCopy', 'Copy');
  copyButton.dataset.action = 'copy';
  copyButton.dataset.id = item.id;

  const deleteButton = document.createElement('button');
  deleteButton.className = 'button ghost';
  deleteButton.type = 'button';
  deleteButton.textContent = t('actionDelete', 'Delete');
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.id = item.id;

  actions.append(copyButton, deleteButton);
  header.append(meta, actions);

  let preview: HTMLImageElement | null = null;
  if (item.type === 'image' && item.imageUrl) {
    preview = document.createElement('img');
    preview.className = 'preview';
    preview.src = item.imageUrl;
    preview.alt = item.imageAlt || item.content || '';
    preview.loading = 'lazy';
  }

  const content = document.createElement('div');
  content.className = 'content';
  content.textContent = item.content;

  const source = document.createElement('div');
  source.className = 'source';

  const pageInfo = document.createElement('span');
  pageInfo.className = 'source-title';
  pageInfo.textContent = item.pageTitle || item.pageUrl || '';
  source.appendChild(pageInfo);

  if (item.type === 'link' && item.linkUrl) {
    const link = document.createElement('a');
    link.href = item.linkUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.linkUrl;
    source.appendChild(link);
  } else if (item.type === 'image' && item.imageUrl) {
    const link = document.createElement('a');
    link.href = item.imageUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.imageUrl;
    source.appendChild(link);
  } else if (item.pageUrl) {
    const link = document.createElement('a');
    link.href = item.pageUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.pageUrl;
    source.appendChild(link);
  }

  li.append(header);
  if (preview) {
    li.append(preview);
  }
  li.append(content, source);
  return li;
};

const render = (items: SavedItem[] | undefined) => {
  const safeItems = Array.isArray(items) ? items : [];
  currentItems = safeItems;
  const filtered = getFilteredItems(safeItems);
  const currentIds = new Set(safeItems.map((item) => item.id));
  Array.from(selectedIds).forEach((id) => {
    if (!currentIds.has(id)) {
      selectedIds.delete(id);
    }
  });
  listEl.innerHTML = '';
  countEl.textContent = String(filtered.length);
  emptyEl.hidden = filtered.length > 0;

  filtered.forEach((item) => {
    listEl.appendChild(buildItemElement(item));
  });
  updateSelectAllLabel(filtered);
};

const loadItems = async () => {
  render(await getItems());
};

const loadLanguagePreference = async () => {
  await applyLanguage();
};

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEY]) {
    render(changes[STORAGE_KEY].newValue as SavedItem[] | undefined);
  }
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextFilter = button.dataset.filter as SavedItem['type'] | 'all' | undefined;
    if (!nextFilter) {
      return;
    }
    activeFilter = nextFilter;
    filterButtons.forEach((btn) =>
      btn.classList.toggle('is-active', btn.dataset.filter === nextFilter)
    );
    render(currentItems);
  });
});

filterInput.addEventListener('input', () => {
  queryText = filterInput.value.trim().toLowerCase();
  render(currentItems);
});

filterClear.addEventListener('click', () => {
  filterInput.value = '';
  queryText = '';
  render(currentItems);
});

// Manual language switching UI removed.


selectAllButton.addEventListener('click', () => {
  const filtered = getFilteredItems(currentItems);
  if (!filtered.length) {
    return;
  }
  const allSelected = filtered.every((item) => selectedIds.has(item.id));
  if (allSelected) {
    filtered.forEach((item) => selectedIds.delete(item.id));
  } else {
    filtered.forEach((item) => selectedIds.add(item.id));
  }
  render(currentItems);
});

copyFilteredButton.addEventListener('click', async () => {
  const filtered = getFilteredItems(currentItems);
  if (!filtered.length) {
    setCopyStatus(t('copyEmpty', 'No items to copy.'));
    return;
  }
  const lines = filtered
    .map((item) => {
      if (item.type === 'link') {
        return item.linkUrl || item.content;
      }
      if (item.type === 'image') {
        return item.imageUrl || item.content;
      }
      return item.content;
    })
    .filter(Boolean);
  const text = lines.join('\n');
  const success = await copyTextToClipboard(text);
  if (success) {
    setCopyStatus(
      t('copySuccess', `Copied ${filtered.length} items.`, [String(filtered.length)])
    );
  } else {
    setCopyStatus(t('copyFailed', 'Copy failed.'));
  }
});

confirmCancel.addEventListener('click', () => {
  closeConfirm();
});

confirmOk.addEventListener('click', async () => {
  if (!pendingDeleteId) {
    closeConfirm();
    return;
  }
  const items = await getItems();
  const nextItems = items.filter((entry) => entry.id !== pendingDeleteId);
  await saveItems(nextItems);
  closeConfirm();
});

confirmModal.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.dataset.close === 'true') {
    closeConfirm();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !confirmModal.hidden) {
    closeConfirm();
  }
});

listEl.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest?.('button[data-action]') as HTMLButtonElement | null;
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (!action || !id) {
    return;
  }
  if (action === 'copy') {
    const item = currentItems.find((entry) => entry.id === id);
    if (!item) {
      setCopyStatus(t('copyFailed', 'Copy failed.'));
      return;
    }
    const text = getCopyValue(item);
    if (!text) {
      setCopyStatus(t('copyFailed', 'Copy failed.'));
      return;
    }
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopyStatus(t('copySingleSuccess', 'Copied.'));
    } else {
      setCopyStatus(t('copyFailed', 'Copy failed.'));
    }
    return;
  }
  if (action === 'delete') {
    const item = currentItems.find((entry) => entry.id === id);
    if (item) {
      openConfirm(item);
    }
  }
});

listEl.addEventListener('change', (event) => {
  const target = event.target as HTMLElement | null;
  const checkbox = target?.closest?.('input[data-select]') as HTMLInputElement | null;
  if (!checkbox) {
    return;
  }
  const id = checkbox.dataset.id;
  if (!id) {
    return;
  }
  if (checkbox.checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
  updateSelectAllLabel(getFilteredItems(currentItems));
});

const init = async () => {
  await loadLanguagePreference();
  await loadItems();
};

void init();
