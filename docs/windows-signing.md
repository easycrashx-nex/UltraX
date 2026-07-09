# Windows Signing

UltraX Browser Windows builds can run unsigned during development, but production releases should be code signed.

## Why Windows Warns

Windows SmartScreen and antivirus products can warn on new or uncommon installers, especially unsigned Electron apps. Signing does not bypass Windows security, but it gives Windows and users a stable publisher identity and helps reputation build over time.

Microsoft's current guidance says SmartScreen reputation is reputation-based. EV certificates no longer automatically bypass SmartScreen warnings by themselves:

```txt
https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
```

False positives can be submitted to Microsoft Security Intelligence:

```txt
https://www.microsoft.com/en-us/wdsi/filesubmission
```

## Certificate Types

Normal code signing certificates verify the publisher identity and sign the installer/executables.

EV code signing certificates require stronger identity validation and may matter for enterprise trust and procurement. EV signing is not a guaranteed instant SmartScreen pass; reputation still has to build.

## Electron Builder Setup

UltraX uses `electron-builder`. Windows signing is driven by environment variables in CI:

```powershell
WIN_CSC_LINK=<base64-pfx-or-secure-url>
WIN_CSC_KEY_PASSWORD=<certificate-password>
```

These values must be configured as GitHub Actions secrets. Do not commit certificate files, passwords, private keys, or token values.

## Current Config

The app currently includes clean Windows metadata:

- stable `appId`: `com.ultrax.browser`
- product name: `UltraX Browser`
- publisher name: `UltraX`
- installer target: NSIS
- requested execution level: `asInvoker`
- no forced elevation
- GitHub Releases update provider over HTTPS

Until a real signing certificate is configured, builds should be treated as unsigned. `verifyUpdateCodeSignature` is disabled so unsigned updater testing remains possible. When production signing is in place and verified, revisit this setting.

## Verify A Signed Build

After configuring signing secrets, download the release artifacts and check signatures:

```powershell
Get-AuthenticodeSignature "UltraX-Browser-Setup-1.0.8-x64.exe"
Get-AuthenticodeSignature "UltraX Browser.exe"
```

The status should be `Valid`, and the signer should match the expected publisher.

## Reputation Notes

Reputation improves with consistent signing, stable publisher identity, clean releases, and user installs over time. Do not use packers, obfuscation, antivirus bypasses, hidden persistence, or unsigned random executable downloads to avoid warnings.
