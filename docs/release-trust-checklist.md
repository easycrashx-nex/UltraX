# Release Trust Checklist

Use this checklist before publishing a public UltraX Browser Windows release.

## Build Source

- Build from GitHub Actions or a clean local checkout.
- Confirm `npm ci` completes without installing from untrusted sources.
- Confirm there are no `postinstall` or packaging scripts that download random executables.
- Confirm generated folders such as `dist/`, `dist-electron/`, `release/`, and `node_modules/` are not committed.

## Security Hygiene

- Confirm no tokens, certificates, passwords, `.env` files, or private keys are committed.
- Confirm Electron remote-page security remains strict: no `webSecurity: false`, no `nodeIntegration: true`, no broad shell/file APIs exposed to websites.
- Confirm the updater uses HTTPS GitHub Releases metadata.
- Confirm release artifacts are not obfuscated, packed, or modified after signing.

## Windows Metadata

- Confirm product name is `UltraX Browser`.
- Confirm publisher name is `UltraX`.
- Confirm executable name is `UltraX Browser`.
- Confirm installer and portable artifact names include version and architecture.
- Confirm installer requested execution level is `asInvoker`.
- Confirm installer does not require admin elevation for normal per-user install.
- Confirm app icon is included in `build/icon.ico`.

## Signing

- Configure `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` as GitHub Actions secrets when a certificate is available.
- Prefer a long-lived OV or EV certificate from a reputable CA; EV helps enterprise identity validation but does not guarantee instant SmartScreen reputation.
- Verify signatures with `Get-AuthenticodeSignature`.
- Keep signing credentials out of the repository.

## Release Assets

- Upload the Setup EXE.
- Upload the Portable EXE.
- Upload `latest.yml`.
- Upload the blockmap.
- Upload `SHA256SUMS.txt`.
- Upload individual `.sha256` files.
- Confirm `latest.yml` points to the Setup EXE.
- Confirm `SHA256SUMS.txt` contains Setup, Portable, blockmap, and `latest.yml` entries.

## False Positive Handling

- If Microsoft Defender or SmartScreen flags a clean build, submit the file to Microsoft Security Intelligence:

```txt
https://www.microsoft.com/en-us/wdsi/filesubmission
```

- VirusTotal can be used for awareness, but it is not proof that a file is safe or unsafe.
- Keep release notes clear so users can see what changed.
