# UltraX Browser v1.1.9

## Security and stability

This release hardens the boundaries added in recent browser, extension, and password-manager updates.

- Password filling remains bound to the exact HTTPS origin and frame that was authorized.
- Remembered permissions distinguish scheme, hostname, `www`, and port.
- Extension identifiers and scoped storage reject prototype-pollution keys.
- Download filenames are normalized and confined to the configured download directory.
- Generic extension panels run in an explicit sandbox without top-navigation authority.

## Update delivery

UltraX still checks the official GitHub Releases feed and shows the newest version, release notes, and release link. Automatic binary download and installation are disabled until Windows releases use a trusted code-signing certificate.

Installed v1.1.8 NSIS builds can use Settings -> Updates to detect, download, and install v1.1.9. The Setup executable remains the fallback and Portable builds remain manual. Verify the matching SHA256 value in `SHA256SUMS.txt` when installing manually.

## Validation

- TypeScript typecheck and production build
- Unit regression suite for origins, password-fill frame binding, extension storage, download paths, and version checks
- Full Electron browser E2E suite
- Packaged Windows extension-sandbox smoke test
