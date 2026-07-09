# Security Policy

## Supported Versions

The latest tagged GitHub Release is the supported version.

## Reporting a Vulnerability

Open a private security advisory on GitHub when the repository is available, or contact the project owner directly.

Do not publish exploit details before a fix is available.

## Electron Security Rules

UltraX must keep:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`

Do not expose raw `ipcRenderer`, Node.js, Electron internals, cookies, passwords, tokens, local files, or unrestricted filesystem access to web pages or extensions.

## Update Security

UltraX uses GitHub Releases and `electron-updater` for the prepared update flow.

Production releases should add:

- Windows code signing certificate
- Release asset checks
- Signed Git tags
- Protected `main` branch
- Required GitHub Actions checks

Unsigned builds can be used for development, but Windows SmartScreen may warn users.
