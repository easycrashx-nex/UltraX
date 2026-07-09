# UltraX Extension Store

UltraX v1.0.5 includes a local Extension Store provider.

## Local Store

The local catalog lives at:

```txt
resources/extensions-store.json
```

Items describe bundled trusted samples:

```json
{
  "id": "ultrax-page-info",
  "name": "UltraX Page Info",
  "version": "1.0.0",
  "description": "Shows basic information about the active tab in a sidebar panel.",
  "author": "UltraX",
  "category": "Productivity",
  "permissions": ["tabs", "activeTab", "sidebar"],
  "source": "builtin",
  "installType": "builtin"
}
```

The Store UI shows Installed, Not Installed, and Update Available states. Installing a local Store item registers the bundled extension and enables it.

## Provider Architecture

UltraX defines a provider shape:

```ts
interface ExtensionStoreProvider {
  listExtensions(): Promise<ExtensionStoreItem[]>
  getExtension(id: string): Promise<ExtensionStoreItem | null>
  installExtension(id: string): Promise<void>
}
```

`LocalExtensionStoreProvider` is active now. `RemoteExtensionStoreProvider` is present only as a disabled future boundary.

## Future Remote Store Requirements

A remote Store must add signatures, hashes, permission review, version validation, update verification, rollback, and abuse reporting before it can be enabled.
