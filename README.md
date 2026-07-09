# UltraX Browser

UltraX is a custom Windows desktop browser shell built with Electron, Chromium WebContentsView, React, TypeScript, and Tailwind CSS.

The project includes:

- Apple-inspired browser chrome and Settings UI
- New Tab shader background
- Bookmarks, history, downloads, privacy, performance, and accessibility controls
- Native UltraX Extensions runtime with local sample extensions
- GitHub Releases-ready update architecture
- NSIS installer and portable Windows builds

## Requirements

- Node.js 22 or newer
- npm
- Windows for the current packaged release targets

## Install

```powershell
npm ci
```

## Development

```powershell
npm run dev
```

## Typecheck and Build

```powershell
npm run typecheck
npm run build
```

## Package Windows Builds

```powershell
npm run dist:win
```

Outputs are written to `release/` and should not be committed. Upload installers and update metadata through GitHub Releases instead.

## Updates

UltraX supports two update paths:

- In-app update checks through Settings -> Updates
- Manual installer updates from GitHub Releases

The in-app updater uses `electron-updater` with GitHub Releases from `easycrashx-nex/UltraX` once release assets are published.

Read:

- [docs/updating.md](docs/updating.md)
- [docs/releases.md](docs/releases.md)

## GitHub Setup

The public GitHub repository is:

```txt
https://github.com/easycrashx-nex/UltraX
```

If a fresh clone has no remote yet, run:

```powershell
git remote add origin https://github.com/easycrashx-nex/UltraX.git
git branch -M main
git push -u origin main
```

Release configuration is described in [docs/releases.md](docs/releases.md).

## Security

Do not commit tokens, signing certificates, `.env` files, local browser data, or generated installers. See [SECURITY.md](SECURITY.md).

## License

This project is currently `UNLICENSED`. See [LICENSE](LICENSE).
