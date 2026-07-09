# UltraX Extensions Compatibility

## Supported in UltraX v1.0.5

UltraX v1.0.5 prioritizes native UltraX extensions built around `ultrax-extension.json`.

Supported now:

- native UltraX manifests
- installed extension metadata
- built-in local Store samples
- Developer Mode local folder loading
- manifest validation
- enable, disable, remove, reload
- sandboxed sidebar panel rendering
- extension-local storage API
- tabs metadata API
- active tab metadata API
- local notification API
- permission display and permission checks
- runtime logs and visible errors

## Native First

Native UltraX extensions use:

```txt
ultrax-extension.json
```

Chrome/Chromium extensions use:

```txt
manifest.json
```

UltraX does not yet load Chrome Web Store packages or Chromium Manifest V3 packages.

## Future Chrome/Chromium Mapping

Possible future mappings:

- `manifest.json` to UltraX manifest metadata
- action/popup UI to UltraX panel host
- storage API to UltraX extension storage
- tabs API to UltraX tabs metadata
- background service worker to a dedicated sandboxed host
- content scripts to a reviewed injection model
- permissions to UltraX permission prompts

## Limitations

These remain unsupported until a separate compatibility layer exists:

- Chrome Web Store install
- Manifest V3 background service workers
- content scripts
- webRequest interception
- cookies API
- native messaging
- cross-extension messaging
- remote code execution

Native UltraX extensions remain the supported extension path for v1.0.5.
