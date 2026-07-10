# UltraX Browser 1.1.10-DevU

Visible product label: `UltraX Browser 1.1.10-DevU`.
Internal package version: `1.1.10`.
Release tag: `v1.1.10`.

## Silent in-app updates

The Updates page keeps download and installation user-controlled. After an update is downloaded, `Install and Restart` prepares all windows, saves the restorable session, locks the password vault, and delegates installation to electron-updater with `isSilent=true` and `isForceRunAfter=true`.

The normal NSIS wizard remains available when a user downloads Setup manually from GitHub Releases. Portable builds remain manual and are not used as the in-app update target.
