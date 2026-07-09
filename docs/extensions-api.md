# UltraX Extension API v1

The v1 API is available as `window.ultrax` inside sandboxed extension panels.

## API Surface

```ts
ultrax.extensions.getSelf()

ultrax.storage.get(key)
ultrax.storage.set(key, value)
ultrax.storage.remove(key)
ultrax.storage.clear()

ultrax.tabs.getActive()
ultrax.tabs.query()

ultrax.notifications.show({ title, message })

ultrax.sidebar.open()
ultrax.sidebar.close()
```

## Permission Mapping

| Permission | APIs |
| --- | --- |
| `storage` | `storage.*` |
| `tabs` | `tabs.query()` |
| `activeTab` | `tabs.getActive()` |
| `notifications` | `notifications.show()` |
| `sidebar` | `sidebar.open()`, `sidebar.close()` |

Every API call is checked in the main process against the calling extension id, enabled state, error state, and manifest permissions.

## Storage Values

Storage values must be JSON-serializable and reasonably small. Storage is isolated by extension id and persisted in UltraX state.

## Unsupported in v1

Content scripts, arbitrary website injection, cookie access, webRequest interception, native filesystem APIs, and direct Electron APIs are intentionally not exposed.
