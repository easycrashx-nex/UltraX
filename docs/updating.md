# Updating UltraX

## Check for updates

1. Open UltraX Settings.
2. Go to Updates.
3. Select the Stable channel.
4. Click Check for Updates.
5. If a newer version exists, choose `Download Update` in UltraX or open the official release from the displayed fallback button.

The check reads release metadata from the official GitHub Releases provider. It does not install anything automatically.

## Install an update

1. Download `UltraX-Browser-Setup-<version>-x64.exe` from the official release.
2. Download or open `SHA256SUMS.txt` from the same release.
3. Verify the installer with `Get-FileHash -Algorithm SHA256`.
4. Run the installer and keep the existing install location.

The Portable executable can be downloaded and verified in the same way.

Official releases: `https://github.com/easycrashx-nex/UltraX/releases`

## In-app installation

UltraX does not install an update without explicit confirmation. After `Install and Restart`, electron-updater runs the downloaded NSIS package through its supported silent path and relaunches UltraX.

Installed NSIS builds use the official GitHub provider and electron-updater. The `v1.2.0` release publishes matching `latest.yml`, NSIS blockmap, and installer metadata. The update manager verifies HTTPS metadata and SHA-512 before `quitAndInstall(true, true)`; it never starts a downloaded executable from the renderer.

Code signing is still not configured. This means Windows SmartScreen warnings may remain even though the release metadata and downloaded bytes are integrity-checked. Portable builds do not participate in in-app installation.
