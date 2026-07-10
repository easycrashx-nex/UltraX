# Updating UltraX

## Check for updates

1. Open UltraX Settings.
2. Go to Updates.
3. Select the Stable channel.
4. Click Check for Updates.
5. If a newer version exists, open the official release from the displayed button.

The check reads release metadata from the official GitHub Releases API. It does not download or execute an installer.

## Install an update

1. Download `UltraX-Browser-Setup-<version>-x64.exe` from the official release.
2. Download or open `SHA256SUMS.txt` from the same release.
3. Verify the installer with `Get-FileHash -Algorithm SHA256`.
4. Run the installer and keep the existing install location.

The Portable executable can be downloaded and verified in the same way.

Official releases: `https://github.com/easycrashx-nex/UltraX/releases`

## Why installation is manual

UltraX does not automatically install unsigned native code. Automatic update installation can return after releases use a trusted Windows code-signing certificate and packaged signature verification is enforced.

The transition from v1.1.8 to v1.1.9 is intentionally manual. The v1.1.9 release does not publish `latest.yml` or a blockmap, preventing older unsigned auto-updaters from installing it automatically.
