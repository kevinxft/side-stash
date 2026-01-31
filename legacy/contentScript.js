let lastContextData = {
  pageTitle: "",
  linkText: "",
  linkUrl: ""
};

function getLinkText(anchor) {
  if (!anchor) {
    return "";
  }
  const text = (anchor.textContent || "").trim();
  if (text) {
    return text;
  }
  const aria = (anchor.getAttribute("aria-label") || "").trim();
  if (aria) {
    return aria;
  }
  const title = (anchor.getAttribute("title") || "").trim();
  if (title) {
    return title;
  }
  return anchor.href || "";
}

function updateContextData(event) {
  const target = event.target;
  const anchor = target?.closest ? target.closest("a") : null;

  lastContextData = {
    pageTitle: document.title || "",
    linkText: anchor ? getLinkText(anchor) : "",
    linkUrl: anchor?.href || ""
  };
}

document.addEventListener("contextmenu", updateContextData, true);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "side-stash-get-context") {
    sendResponse({
      ...lastContextData,
      pageTitle: document.title || lastContextData.pageTitle
    });
    return true;
  }
  return false;
});
