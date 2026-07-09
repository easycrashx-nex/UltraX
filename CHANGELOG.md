# UltraX Browser Changelog

## 1.0.6 - Update System Release

### Added

- Added GitHub Releases-ready update architecture using `electron-updater`.
- Added safe typed update IPC for status, check, download, install/restart, and release page actions.
- Added an Updates settings page with current version, channel, latest version, last checked time, progress, release notes, and error states.
- Added persisted update preferences for auto-check, auto-download, notification preference, channel, and last checked time.
- Added GitHub Actions workflows for build validation and tagged release publishing.
- Added GitHub-ready project files: README, license, contributing guide, security policy, issue templates, PR template, release docs, and updating docs.
- Added explicit GitHub Releases provider metadata for `easycrashx-nex/UltraX` in packaged builds.
- Added a safe `window.ultraX.updates` preload API alias for update-specific actions.

### Improved

- Updated package and visible current-version metadata to UltraX 1.0.6.
- Kept manual installer updates as a supported path alongside in-app updates.
- Added release security notes for unsigned development builds and future Windows code signing.
- Quick Settings now opens Settings > Updates when an update is available or downloaded.
- The release workflow verifies `app-update.yml`, `latest.yml`, and required Windows update assets before publishing.

### Security

- Update actions are exposed through narrow preload APIs only.
- Updates use the updater framework rather than executing downloaded files manually.
- GitHub release publishing is prepared without committing tokens, signing certificates, or generated installers.

## 1.0.5 - Extensions Runtime Update

### Main Goal

UltraX v1.0.5 turns the native Extensions foundation into a working first runtime with sandboxed panels, permission-checked APIs, extension-local storage, runtime logs, and a local Extension Store.

### Extension Runtime

- Added sandboxed sidebar panel rendering for native UltraX extensions.
- Added a `window.ultrax` panel bridge with typed, permission-checked API calls.
- Added extension runtime logs and visible extension error handling.
- Added extension-local storage APIs with JSON-serializable values.
- Added active tab, tabs query, notification, and sidebar APIs.

### Local Extension Store

- Added a local Extension Store provider and bundled Store catalog.
- Added install flow for trusted built-in sample extensions.
- Added Store UI states for Installed, Not Installed, and Update Available.
- Added a disabled Remote Store provider boundary for future signed packages.

### Quick Settings Access

- Added an Extensions section to Quick Settings for installed native UltraX extensions.
- Added direct panel opening and enable/disable controls for extensions from Quick Settings.
- Added a future-ready Plugins section that routes to the existing Plugins settings placeholder.

### Built-In Sample Extensions

- Upgraded UltraX Notes into a working storage/sidebar panel extension.
- Added UltraX Page Info as a second built-in sample extension.

### Security

- Extension code runs without Node.js or direct Electron access.
- API calls are checked by extension id, enabled state, error state, and requested permissions.
- Remote Store installation, Chrome Web Store support, content scripts, cookies, and webRequest remain intentionally unsupported.

## 1.0.4 - Extensions System Update

### Main Goal

UltraX v1.0.4 adds the first native UltraX Extensions system with a real manager UI, manifest validation, Developer Mode loading, permission explanations, and a built-in sample extension.

### Native UltraX Extensions

- Added `ultrax-extension.json` manifest support for native UltraX extensions.
- Added typed extension manifest, installed extension, status, source, and permission models.
- Added a safe registry that validates local extension folders without executing extension JavaScript.
- Added Developer Mode for loading unpacked local UltraX extension folders.
- Added enable/disable, remove local registration, reload validation, and open extensions folder actions.
- Added built-in `UltraX Notes Sidebar` sample extension.

### Extension Manager UI

- Replaced the Extensions placeholder page with installed extension cards, status badges, permission pills, details panel, error/warning display, and permission guide.
- Clarified the difference between Extensions and Plugins.
- Added sensitive permission highlighting for history, downloads, bookmarks, settings, and clipboard.

### Security Notes

- Local extension scripts are not executed in v1.0.4.
- Extensions do not receive Node.js or Electron internals.
- Browser security settings remain strict.
- Chrome/Chromium extension compatibility is documented as future work, not enabled.

## 1.0.3 - Performance Settings Expansion

### Main Goal

UltraX v1.0.3 turns the Performance settings page into a full browser performance control center while preserving the existing Apple-inspired Settings design and Electron security model.

### New Performance Settings

- Added Performance Mode options: Efficiency, Balanced, Performance, and Ultra.
- Expanded shader controls with Low/Balanced/High/Ultra quality, FPS cap preference, focus pause, battery-saver hook, Efficiency-mode shader disable, and reduced visual effects.
- Added New Tab performance controls for preload, warm memory preference, lazy quick links, reduced animations, and cache clearing.
- Added tab performance controls for Memory Saver, inactive tab suspension preferences, suspend delay, keep-active rules, and site exceptions.
- Added startup/background and network performance groups with persisted future hooks.
- Added hardware/rendering diagnostics with acceleration status, GPU/WebGL status, process counts, relaunch flow, and internal diagnostics access.
- Added private-data-safe diagnostics copy/export and Performance-only reset.

### Implementation Notes

- All new Performance settings persist through the existing typed settings pipeline.
- Hardware acceleration is applied safely at next launch because Electron requires startup-time toggling.
- Network cache clearing uses Chromium cache clearing without deleting cookies or local site storage.
- Unsupported runtime behavior is stored as future hooks without pretending the underlying browser engine already implements it.

## 1.0.2 - Top Bar Spacing Polish

### Main Goal

UltraX v1.0.2 tightens the browser chrome so the tab bar, toolbar, address bar, and bookmarks bar feel more compact, balanced, and Apple-inspired without changing browser behavior.

### Browser Chrome Polish

- Reduced the overall top chrome height from 132px to 108px.
- Slimmed the tab strip while preserving tab switching, close controls, new tab, and window controls.
- Tightened toolbar padding and aligned navigation buttons, address input, bookmark star, and right-side icons.
- Made the address bar more compact with cleaner vertical centering and subtle inset depth.
- Reduced the bookmarks/status row to a slimmer integrated strip.
- Added the UltraX X logo as the Windows app icon for packaged EXE, Start/Search, taskbar, and installed shortcuts.

## 1.0.1 - Apple-Inspired Settings Update

### Main Goal

UltraX v1.0.1 focuses on making the Settings experience feel calmer, more premium, and more strongly inspired by macOS desktop applications while preserving the UltraX browser identity.

### New Features

- Added official v1.0.1 release metadata.
- Expanded Settings navigation with General, Browser, Profiles, AI, Plugins, Extensions, Updates, and About UltraX pages.
- Added release-focused About and Updates content for local version diagnostics.

### Settings Redesign

- Reworked the Settings shell with a glass sidebar, calmer page header, grouped settings cards, and more spacious content rhythm.
- Improved category organization so browser, privacy, accessibility, release, and extension-related settings are easier to scan.

### Apple-Inspired UI Improvements

- Added softer blur layers, larger rounded groups, quieter separators, and more precise control alignment.
- Replaced generic form styling with custom switch, select, text input, segmented, slider, and action-row treatments.
- Fixed the Settings scrollbars in dark mode so Windows no longer renders a bright native scrollbar inside the dark glass layout.

### Animation Improvements

- Added subtle panel, category, row, and control transitions.
- Motion respects UltraX reduced-motion settings and system reduced-motion preferences.

### Accessibility Improvements

- Preserved keyboard focus rings and semantic labels.
- Improved hit areas, contrast, and readable helper text across Settings controls.

### Known Issues

- Extensions, Plugins, AI, Profiles, and Updates remain structured MVP pages until the underlying browser subsystems exist.
- Auto-update and code signing are not configured yet.

### Recommended Next Steps for 1.1.0

- Add a real extension/plugin subsystem.
- Add auto-update infrastructure and signed Windows releases.
- Add per-site permission management and profile storage.
