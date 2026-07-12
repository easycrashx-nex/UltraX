# Releasing UltraX

## Versioning

Use patch releases for focused improvements:

```powershell
npm version 1.2.2 --no-git-tag-version
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
git tag v1.2.2
git push origin v1.2.2
```

The workflow:

- installs dependencies with `npm ci`
- typechecks
- builds
- packages Windows NSIS and Portable builds
- creates or updates the GitHub Release through GitHub CLI
- runs unit, Electron E2E, and packaged extension-sandbox tests
- generates SHA256 checksums
- uploads installer, portable EXE, and checksum files with `--clobber`

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

## Manual Release Assets

Until trusted Windows code signing is configured, the release must contain:

- `UltraX-Browser-Setup-<version>-x64.exe`
- `UltraX-Browser-<version>-Portable-x64.exe`
- `SHA256SUMS.txt`
- individual `.sha256` files

Upload the `latest.yml` and NSIS blockmap generated alongside the installer even while code signing is pending. The updater validates HTTPS metadata and SHA-512; the remaining SmartScreen limitation must be documented honestly and is separate from metadata integrity.

## Production Checklist

- Confirm `app-update.yml` contains the GitHub provider, owner, and repo.
- Protect `main`.
- Require the build workflow.
- Sign release tags.
- Configure Windows code signing.
- Complete [release-trust-checklist.md](release-trust-checklist.md).
- Verify installer and portable EXE on a clean Windows machine.
