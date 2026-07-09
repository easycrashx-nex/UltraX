# Contributing

## Local Setup

```powershell
npm ci
npm run typecheck
npm run build
```

## Development Rules

- Keep Electron security strict.
- Do not enable `nodeIntegration` for remote pages.
- Do not disable `contextIsolation`, sandboxing, or `webSecurity`.
- Do not commit generated files from `dist/`, `dist-electron/`, or `release/`.
- Do not commit secrets, tokens, signing certificates, or local browser/user data.
- Keep UI changes consistent with the existing UltraX Settings and browser chrome style.

## Pull Requests

Before opening a pull request:

```powershell
npm run typecheck
npm run build
```

If the change touches packaging or updates, also run:

```powershell
npm run dist:win
```

Unsigned local packages are acceptable for development, but production releases should use code signing.
