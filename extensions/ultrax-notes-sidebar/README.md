# UltraX Notes

Built-in sample extension for UltraX Browser v1.0.5.

This extension demonstrates the native UltraX extension manifest format:

- `ultrax-extension.json`
- scoped permissions
- sandboxed sidebar panel rendering
- extension-local storage through `window.ultrax.storage`
- settings page registration

UltraX runs this panel in a sandboxed host. It has no direct Node.js or Electron access.
