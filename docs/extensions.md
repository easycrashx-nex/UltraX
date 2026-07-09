# UltraX Native Extensions

UltraX v1.0.5 supports native UltraX extensions with a scoped manifest, local Store listings, Developer Mode loading, sandboxed sidebar panels, permission-checked APIs, and extension-local storage.

## Extension Folder

```txt
my-extension/
  ultrax-extension.json
  index.js
  panel.html
  icon.png
  README.md
```

## Manifest

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "Adds a sidebar tool.",
  "author": "Me",
  "icon": "icon.png",
  "main": "index.js",
  "panel": "panel.html",
  "permissions": ["storage", "sidebar"]
}
```

UltraX validates ids, required fields, permissions, and relative file paths. Paths must stay inside the extension folder.

## Panels

If `panel` is present, UltraX can open the extension inside the right sidebar. The panel runs inside a sandboxed iframe host. UltraX injects a small `window.ultrax` bridge into that host; the extension does not get Node.js, Electron, filesystem, cookies, passwords, or browser internals.

## Developer Mode

Developer Mode allows local unpacked folders to be loaded or validated. Local extensions are only trusted for the local user and are not distributed, signed, or auto-updated.

## Built-In Samples

- `UltraX Notes`: demonstrates `storage` and `sidebar`.
- `UltraX Page Info`: demonstrates `tabs`, `activeTab`, and `sidebar`.
