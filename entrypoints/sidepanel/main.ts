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
const selectAllCheckbox = document.getElementById('select-all') as HTMLInputElement;
const selectAllLabel = document.getElementById('select-all-label') as HTMLSpanElement;
const selectAllCount = document.getElementById('select-all-count') as HTMLSpanElement;
const copyFilteredButton = document.getElementById('copy-filtered') as HTMLButtonElement;
const deleteSelectedButton = document.getElementById('delete-selected') as HTMLButtonElement;
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
let pendingDeleteIds: string[] = [];
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

const getHostname = (url?: string) => {
  if (!url) {
    return '';
  }
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
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

function updateCopyButtonLabel() {
  const count = selectedIds.size;
  copyFilteredButton.textContent = t('copySelected', 'Copy');
  deleteSelectedButton.textContent = t('deleteSelected', 'Delete');
  const disabled = count === 0;
  copyFilteredButton.disabled = disabled;
  deleteSelectedButton.disabled = disabled;
}

const applyI18n = () => {
  setText('panel-title', 'panelTitle', 'Side Stash');
  setText(
    'panel-subtitle',
    'panelSubtitle',
    'Quickly stash text, links, and images'
  );
  setText('empty-title', 'emptyTitle', 'Nothing saved yet');
  setText(
    'empty-hint',
    'emptyHint',
    'Right-click on a page to save text, links, or images.'
  );
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
  selectAllLabel.textContent = t('selectAll', 'Select all');
  updateCopyButtonLabel();
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
  pendingDeleteIds = [item.id];
  confirmItem.textContent = item.content;
  confirmMessage.textContent = t('confirmDelete', 'Delete this item?');
  confirmModal.hidden = false;
  confirmOk.focus();
};

const closeConfirm = () => {
  pendingDeleteIds = [];
  confirmModal.hidden = true;
};

const openConfirmBulk = (items: SavedItem[]) => {
  pendingDeleteIds = items.map((item) => item.id);
  confirmItem.textContent = t('confirmSelectedCount', 'Selected items: $1', [
    String(items.length),
  ]);
  confirmMessage.textContent = t(
    'confirmDeleteMultiple',
    'Delete $1 items?',
    [String(items.length)]
  );
  confirmModal.hidden = false;
  confirmOk.focus();
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
    selectAllLabel.textContent = t('selectAll', 'Select all');
    selectAllCheckbox.disabled = true;
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    selectAllCount.hidden = true;
    return;
  }
  selectAllCheckbox.disabled = false;
  const allSelected = filtered.every((item) => selectedIds.has(item.id));
  const someSelected = filtered.some((item) => selectedIds.has(item.id));
  selectAllCheckbox.checked = allSelected;
  selectAllCheckbox.indeterminate = !allSelected && someSelected;
  selectAllLabel.textContent = t('selectAll', 'Select all');
  if (selectedIds.size > 0) {
    selectAllCount.textContent = `(${selectedIds.size})`;
    selectAllCount.hidden = false;
  } else {
    selectAllCount.hidden = true;
  }
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
  li.className = selectedIds.has(item.id) ? 'item is-selected' : 'item';

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
  copyButton.className = 'icon-button';
  copyButton.type = 'button';
  copyButton.dataset.action = 'copy';
  copyButton.dataset.id = item.id;
  copyButton.setAttribute('aria-label', t('actionCopy', 'Copy'));
  copyButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z" fill="currentColor"/></svg>';

  const deleteButton = document.createElement('button');
  deleteButton.className = 'icon-button danger';
  deleteButton.type = 'button';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.id = item.id;
  deleteButton.setAttribute('aria-label', t('actionDelete', 'Delete'));
  deleteButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>';

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

  const sourceDomain =
    getHostname(item.pageUrl) ||
    getHostname(item.linkUrl) ||
    getHostname(item.imageUrl);
  if (sourceDomain) {
    const line = document.createElement('span');
    line.className = 'source-line';
    line.textContent = `${t('sourceLabel', 'Source')}: ${sourceDomain}`;
    source.appendChild(line);
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
  updateCopyButtonLabel();
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


selectAllCheckbox.addEventListener('change', () => {
  const filtered = getFilteredItems(currentItems);
  if (!filtered.length) {
    return;
  }
  if (selectAllCheckbox.checked) {
    filtered.forEach((item) => selectedIds.add(item.id));
  } else {
    filtered.forEach((item) => selectedIds.delete(item.id));
  }
  render(currentItems);
  updateCopyButtonLabel();
});

copyFilteredButton.addEventListener('click', async () => {
  const selected = currentItems.filter((item) => selectedIds.has(item.id));
  if (!selected.length) {
    setCopyStatus(t('copyNoneSelected', 'No items selected.'));
    return;
  }
  const lines = selected
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
      t('copySuccess', `Copied ${selected.length} items.`, [String(selected.length)])
    );
  } else {
    setCopyStatus(t('copyFailed', 'Copy failed.'));
  }
});

deleteSelectedButton.addEventListener('click', () => {
  const selected = currentItems.filter((item) => selectedIds.has(item.id));
  if (!selected.length) {
    setCopyStatus(t('deleteNoneSelected', 'No items selected.'));
    return;
  }
  openConfirmBulk(selected);
});

confirmCancel.addEventListener('click', () => {
  closeConfirm();
});

confirmOk.addEventListener('click', async () => {
  if (!pendingDeleteIds.length) {
    closeConfirm();
    return;
  }
  const items = await getItems();
  const ids = new Set(pendingDeleteIds);
  const nextItems = items.filter((entry) => !ids.has(entry.id));
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
  updateCopyButtonLabel();
  render(currentItems);
});

const init = async () => {
  await loadLanguagePreference();
  await loadItems();
};

void init();
