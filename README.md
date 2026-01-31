# Side Stash

Side Stash is a lightweight browser side‑panel collector. Right‑click any webpage to save text, links, or images, then review, filter, copy, and delete items from a clean side panel UI. All data stays on your device.

---

## Screenshot

![Side Stash screenshot](./1.png)

---

## Features

- Right‑click save: text, links, images
- Side panel list with local persistence
- Quick filters by type and keyword/URL
- Multi‑select copy (newline separated) and bulk delete
- Single‑item copy and delete
- Source display (domain only)

---

## How It Works

1. Select text or right‑click a link/image
2. Choose “Save to side panel”
3. Open the side panel to view, filter, copy, or delete

---

## Permissions

- `contextMenus`: add right‑click menu items
- `storage`: persist saved items locally
- `tabs`: read page title/URL for context
- `host_permissions: <all_urls>`: enable saving on any site
- `sidePanel`: render the side panel UI

---

## Privacy

- All data is stored locally in `chrome.storage.local`
- No data is sent to any server
- No tracking or analytics

---

## Development

```bash
npm install
npm run dev
```

Build the production bundle:

```bash
npm run build
```

Package for Chrome Web Store:

```bash
npm run zip
```

---

## Project Structure

```
entrypoints/
  background.ts
  content.content.ts
  sidepanel/
    index.html
    main.ts
    style.css
public/
  icon-16.png
  icon-24.png
  icon-32.png
  icon-48.png
  icon-128.png
wxt.config.ts
```

---

## License

MIT
