# Releasing UltraX

## Versioning

Use patch releases for focused improvements:

```powershell
npm version 1.1.8 --no-git-tag-version
```

Update `CHANGELOG.md` before tagging.

## Local Release Build

```powershell
npm ci
npm run typecheck
npm run test:e2e
npm run build
npm run dist:win
```

Expected local artifacts:

- `release/UltraX-Browser-Setup-<version>-x64.exe`
- `release/UltraX-Browser-<version>-Portable-x64.exe`
- `release/latest.yml`
- `release/SHA256SUMS.txt`

Do not commit `release/`.

## GitHub Repository Setup

The release repository is:

```powershell
git remote add origin https://github.com/easycrashx-nex/UltraX.git
```

Skip the command if `origin` already points to that URL.

## GitHub Actions Release

The release workflow runs on tags:

```powershell
git tag v1.1.8
git push origin v1.1.8
```

The workflow:

- installs dependencies with `npm ci`
- typechecks
- builds
- packages Windows NSIS and Portable builds
- creates or updates the GitHub Release through GitHub CLI
- verifies packaged `app-update.yml` points to `easycrashx-nex/UltraX`
- verifies `latest.yml` exists and references the Setup installer
- generates SHA256 checksums
- re-uploads installer, portable EXE, blockmap, `latest.yml`, and checksum files with `--clobber`

## E2E Tests

UltraX includes Electron Playwright coverage for tab UX, settings persistence, encrypted password-vault workflows, and Updates page smoke coverage:

```powershell
npm run test:e2e
npm run test:e2e:headed
```

The GitHub Actions E2E workflow is manual (`workflow_dispatch`) so normal build and release jobs are not blocked by GUI-runner flakiness.

## Required Secrets

The workflow can publish with the built-in `GITHUB_TOKEN`.

For production signing, add:

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

Do not commit signing certificates or passwords.
See [windows-signing.md](windows-signing.md).

## Auto-Updater Metadata

`electron-builder` generates update metadata for `electron-updater` when GitHub Releases are configured. The GitHub Actions workflow then uploads that metadata to the tagged GitHub Release.

The Windows release must contain:

- `UltraX-Browser-Setup-<version>-x64.exe`
- `UltraX-Browser-Setup-<version>-x64.exe.blockmap`
- `UltraX-Browser-<version>-Portable-x64.exe`
- `latest.yml`
- `SHA256SUMS.txt`
- individual `.sha256` files

## Production Checklist

- Confirm `app-update.yml` contains the GitHub provider, owner, and repo.
- Protect `main`.
- Require the build workflow.
- Sign release tags.
- Configure Windows code signing.
- Complete [release-trust-checklist.md](release-trust-checklist.md).
- Verify installer and portable EXE on a clean Windows machine.
