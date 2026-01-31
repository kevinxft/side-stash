import { browser } from 'wxt/browser';

type ContextData = {
  pageTitle: string;
  linkText: string;
  linkUrl: string;
  imageAlt: string;
  imageUrl: string;
};

const getLinkText = (anchor: HTMLAnchorElement | null) => {
  if (!anchor) {
    return '';
  }

  const text = (anchor.textContent || '').trim();
  if (text) {
    return text;
  }

  const aria = (anchor.getAttribute('aria-label') || '').trim();
  if (aria) {
    return aria;
  }

  const title = (anchor.getAttribute('title') || '').trim();
  if (title) {
    return title;
  }

  return anchor.href || '';
};

const getImageAlt = (image: HTMLImageElement | null) => {
  if (!image) {
    return '';
  }
  const alt = (image.getAttribute('alt') || '').trim();
  if (alt) {
    return alt;
  }
  const aria = (image.getAttribute('aria-label') || '').trim();
  if (aria) {
    return aria;
  }
  const title = (image.getAttribute('title') || '').trim();
  if (title) {
    return title;
  }
  return '';
};

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    let lastContextData: ContextData = {
      pageTitle: document.title || '',
      linkText: '',
      linkUrl: '',
      imageAlt: '',
      imageUrl: '',
    };

    const updateContextData = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      const image = target?.closest?.('img') as HTMLImageElement | null;

      lastContextData = {
        pageTitle: document.title || '',
        linkText: anchor ? getLinkText(anchor) : '',
        linkUrl: anchor?.href || '',
        imageAlt: getImageAlt(image),
        imageUrl: image?.currentSrc || image?.src || '',
      };
    };

    document.addEventListener('contextmenu', updateContextData, true);

    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === 'side-stash-get-context') {
        return Promise.resolve({
          ...lastContextData,
          pageTitle: document.title || lastContextData.pageTitle,
        });
      }
      return undefined;
    });
  },
});
