# UltraX Extensions Security

UltraX extensions are treated as untrusted local content unless they are bundled samples.

## Runtime Boundary

- Extension panels run in a sandboxed iframe.
- Extension code has no direct Node.js access.
- Extension code has no direct Electron access.
- APIs flow through typed `postMessage` and privileged preload IPC.
- Main process checks extension id, enabled state, error state, and permissions.

## Blocked Capabilities

UltraX does not expose:

- cookies
- passwords
- tokens
- unrestricted filesystem access
- raw IPC
- `webRequest`
- website content-script injection
- disabled web security
- disabled context isolation

## Developer Mode

Developer Mode is required to load unpacked local folders. Local developer extensions are for local testing only and are not signed or remotely updated.

## Remote Store TODOs

Before remote installation exists, UltraX must require:

- signed packages
- manifest hashes
- permission review
- update verification
- server-side malware review
- local rollback
- clear user consent for sensitive permissions
