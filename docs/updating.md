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

UltraX uses GitHub Releases from:

```txt
https://github.com/easycrashx-nex/UltraX/releases
```

Packaged Windows builds include `app-update.yml` pointing at `easycrashx-nex/UltraX`. The release feed must include `latest.yml`, the Setup EXE, and the Setup blockmap for in-app updates to work.

## Development Limitation

In-app update checks require a packaged build with release metadata. Running from `npm run dev` or `electron .` will report that update checks require a packaged UltraX build.

## Testing the Real Update Flow

To test production updates, install an older packaged build such as UltraX `1.0.5`, publish a newer release such as `v1.0.6`, then open Settings > Updates in the older app and use Check for Updates, Download Update, and Install and Restart.

If the installed app is already on the same version as the newest GitHub Release, the updater should correctly report that UltraX is up to date.
