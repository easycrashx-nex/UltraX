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
`CSC_LINK` and `CSC_KEY_PASSWORD` are also recognized by electron-builder, but UltraX standardizes on the Windows-specific `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` names in GitHub Actions.

For EV or hardware-backed signing, use the certificate-store or provider-specific setup required by the certificate vendor and keep the private key on the token/HSM. Do not export or commit EV key material.

## Current Config

The app currently includes clean Windows metadata:

- stable `appId`: `com.ultrax.browser`
- product name: `UltraX Browser`
- publisher name: `UltraX`
- executable name: `UltraX Browser`
- installer target: NSIS
- requested execution level: `asInvoker`
- no forced elevation
- SHA256 release checksums
- GitHub Releases update provider over HTTPS

Until a real signing certificate is configured, builds should be treated as unsigned. `verifyUpdateCodeSignature` is disabled so unsigned updater testing remains possible. When production signing is in place and verified, revisit this setting.

## Verify A Signed Build

After configuring signing secrets, download the release artifacts and check signatures:

```powershell
Get-AuthenticodeSignature "UltraX-Browser-Setup-1.0.9-x64.exe"
Get-AuthenticodeSignature "UltraX Browser.exe"
```

The status should be `Valid`, and the signer should match the expected publisher.

## Reputation Notes

Reputation improves with consistent signing, stable publisher identity, clean releases, and user installs over time. Do not use packers, obfuscation, antivirus bypasses, hidden persistence, or unsigned random executable downloads to avoid warnings.

## False Positive Submission

If Microsoft Defender flags a clean signed or unsigned UltraX build, submit the exact release file to Microsoft Security Intelligence:

```txt
https://www.microsoft.com/en-us/wdsi/filesubmission
```

Include the release URL, SHA256 checksum, app version, and a short note that UltraX is an Electron browser distributed through GitHub Releases.
