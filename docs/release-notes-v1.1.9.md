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

For v1.1.9, download the Setup or Portable executable from the official GitHub Release and verify the matching SHA256 value in `SHA256SUMS.txt`.

## Validation

- TypeScript typecheck and production build
- Unit regression suite for origins, password-fill frame binding, extension storage, download paths, and version checks
- Full Electron browser E2E suite
- Packaged Windows extension-sandbox smoke test
