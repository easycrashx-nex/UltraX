# Updating UltraX

UltraX supports two update paths.

## In-App Updates

1. Open UltraX.
2. Open Settings.
3. Go to Updates.
4. Select the Stable channel.
5. Click Check.
6. If an update is available, click Download.
7. After download, click Restart to install.

UltraX never installs an update silently. Restart/install requires user action.

## Manual Installer Updates

You can also update manually:

1. Open the UltraX GitHub Releases page.
2. Download the newest `UltraX Setup x64.exe`.
3. Run the installer.
4. Keep the existing install location unless you intentionally want to move it.

The portable EXE can also be downloaded and run directly.

## Current Release Source

The update architecture is prepared for GitHub Releases. Before public release, replace placeholder repository values with the actual GitHub repository and publish a tagged release.

## Development Limitation

In-app update checks require a packaged build with release metadata. Running from `npm run dev` or `electron .` will report that update checks require a packaged UltraX build.
