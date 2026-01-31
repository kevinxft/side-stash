import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    version: '0.1.0',
    permissions: ['contextMenus', 'storage', 'tabs'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: '/icon-16.png',
      24: '/icon-24.png',
      32: '/icon-32.png',
      48: '/icon-48.png',
      128: '/icon-128.png',
    },
    action: {
      default_title: '__MSG_extName__',
      default_icon: {
        16: '/icon-16.png',
        24: '/icon-24.png',
        32: '/icon-32.png',
        48: '/icon-48.png',
        128: '/icon-128.png',
      },
    },
  },
});
