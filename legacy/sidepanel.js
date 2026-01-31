const STORAGE_KEY = "items";
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");

function formatTime(iso) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildItemElement(item) {
  const li = document.createElement("li");
  li.className = "item";

  const header = document.createElement("div");
  header.className = "item-header";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = item.type === "link" ? "LINK" : "TEXT";

  const time = document.createElement("span");
  time.className = "time";
  time.textContent = formatTime(item.createdAt);

  header.append(badge, time);

  const content = document.createElement("div");
  content.className = "content";
  content.textContent = item.content;

  const source = document.createElement("div");
  source.className = "source";

  const pageInfo = document.createElement("span");
  pageInfo.textContent = item.pageTitle || item.pageUrl || "";
  source.appendChild(pageInfo);

  if (item.type === "link" && item.linkUrl) {
    const link = document.createElement("a");
    link.href = item.linkUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.linkUrl;
    source.appendChild(link);
  } else if (item.pageUrl) {
    const link = document.createElement("a");
    link.href = item.pageUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.pageUrl;
    source.appendChild(link);
  }

  li.append(header, content, source);
  return li;
}

function render(items) {
  const safeItems = Array.isArray(items) ? items : [];
  listEl.innerHTML = "";
  countEl.textContent = String(safeItems.length);
  emptyEl.hidden = safeItems.length > 0;

  safeItems.forEach((item) => {
    listEl.appendChild(buildItemElement(item));
  });
}

function loadItems() {
  chrome.storage.local.get({ [STORAGE_KEY]: [] }, (data) => {
    render(data[STORAGE_KEY]);
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    render(changes[STORAGE_KEY].newValue || []);
  }
});

loadItems();
