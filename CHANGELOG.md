# UltraX Browser Changelog

## 1.2.3 - WebContentsView Fullscreen Fallback

- Added a narrow, sender-validated `fullscreenchange` bridge for embedded Chromium pages.
- Fixed fullscreen handling when Electron does not forward the native HTML fullscreen event from a `WebContentsView`.

## 1.2.2 - HTML Fullscreen Fix

- Fixed fullscreen buttons on YouTube, Twitch, and other HTML5 media pages.
- Routed Chromium HTML fullscreen events through the frameless UltraX window.
- Expanded the active page view across the complete window in fullscreen and restored the browser chrome when exiting.

## 1.2.1 - Twitch Shutdown Crash Fix

- Fixed a main-process crash when closing UltraX while Twitch or another audio page was active.
- Ignored late audio, title, navigation, and tab lifecycle events after a WebContents instance was destroyed or its tab was removed.
- Hardened mute, tab move, New Tab conversion, and browser disposal paths against destroyed WebContents.

## 1.2.0 - Password Save & Autofill Integration

- Added isolated top-level login form detection with transient Main-process candidate handling.
- Added trusted UltraX Save Password and Update Password prompts.
- Added exact-origin autofill account suggestions with explicit user selection.
- Added Never Save origin rules and Passwords & Autofill controls.
- Blocked HTTP, hidden-frame, cross-origin-frame, lookalike-domain, and inactive-tab autofill paths.
- Kept password values out of renderer state, extension APIs, logs, and persistent browser state.

## 1.1.10-DevU - Silent In-App Updates

- Added explicit update download and install actions.
- Normal in-app installation now uses electron-updater's silent NSIS path and restarts UltraX automatically.
- Added duplicate-install protection, lifecycle-safe update shutdown, and restart bypass for normal close confirmation.
- Preserved the manual Setup fallback and separate portable build behavior.

## 1.1.9-Fix - Quick Settings and New Tab Layout Fix

- Fixed native `WebContentsView` bounds covering the left edge of Quick Settings on remote pages.
- Added a central browser layout calculation for Quick Settings, side panels, suggestions, downloads, and New Tab transitions.
- Fixed Quick Settings internal scrolling with a stable header and accessible footer action.
- Fixed remote-view detachment and lifecycle guards when switching between websites and New Tab.
- Fixed address suggestion max-height and overlay scrolling without pushing the New Tab surface.
- Visible product label is `UltraX Browser 1.1.9-Fix`; internal package version is `1.1.9-fix.1`.

## 1.1.9 - In-App Updates and Release Hardening

### Security

- Bound password filling to the originally authorized origin and concrete main-frame instance so navigation races cannot inject credentials into a later origin.
- Changed remembered site permissions from hostname-only keys to complete HTTP(S) origins, preserving scheme, port, and `www` boundaries.
- Rejected prototype-sensitive extension IDs and storage keys and moved extension storage to own-property, prototype-less buckets.
- Sanitized every suggested download filename before resolving a save path, including Windows device names, ADS separators, path traversal, control characters, and trailing dots or spaces.
- Sandboxed generic extension panels without same-origin or top-navigation authority and restricted message handling to the embedded frame.
- Removed automatic update binary download and installation until UltraX releases use trusted Windows code signing. Version checks now use the read-only GitHub Releases API and route users to the official release page.

### Tests and Release

- Added focused regression coverage for all four validated security findings and safe control cases.
- Added a packaged Electron security smoke test for extension-panel sandboxing.
- Made unit tests part of the Build workflow and Electron E2E tests part of push, pull-request, and release validation.
- Restored electron-updater metadata for the existing unsigned Windows release: `latest.yml` and the NSIS blockmap now ship with the matching installer.
- Added in-app check, download progress, retryable errors, and Install and Restart flow with session persistence and vault locking.
- Kept the Setup installer as the verified fallback and the Portable build as a manual-only artifact.

## 1.1.8 - Scrollable Tabs and Secure Local Password Manager

### Added

- Added a Firefox-like horizontally scrollable normal tab region with fixed pinned tabs, readable 140 px minimum widths, conditional overflow controls, and a searchable All Tabs menu.
- Added active-tab auto-scroll, local wheel and touchpad scrolling, and edge auto-scroll while reordering tabs in a scrolled strip.
- Added a local-first encrypted password vault with master-password setup, authenticated AES-256-GCM storage, memory-hard scrypt key derivation, optional OS-backed quick unlock, atomic writes, and encrypted last-known-good backups.
- Added Passwords & Autofill Settings and Quick Settings access with redacted login search, CRUD, favorites, tags, CSPRNG password generation, local health checks, clipboard protection, CSV import, and encrypted backup import/export.
- Added explicit user-triggered credential fill for exact matching HTTPS origins in the active top-level frame.
- Added password-manager threat model, architecture, security guidance, and v1.1.8 security review documentation.

### Security

- Password-manager IPC is shell-only, typed, sender validated, and unavailable to websites, extensions, and plugins.
- Password lists never return stored passwords; copy and fill actions complete in the main process.
- HTTP and child-frame password fill are blocked, repeated unlock failures are rate limited, and screen lock/suspend clear the in-memory vault key.
- Production shell DevTools are disabled to reduce accidental secret exposure.
- Automatic form capture and save/update prompts remain disabled until UltraX has a dedicated isolated and audited content bridge.

### Tests

- Added cryptography, tamper detection, wrong-password, origin matching, generator, clipboard ownership, CSV import, vault restart, atomic backup, and encrypted backup unit coverage.
- Added Electron E2E coverage for tab overflow, pinned-tab stability, active-tab visibility, drag edge auto-scroll, encrypted vault CRUD, lock/unlock, plaintext-at-rest checks, and HTTP fill blocking.

## 1.1.7 - Address Suggestions Layering Patch

### Fixed

- Kept the full address-bar suggestion list visible above native web content, including while Settings or side panels are open.
- Dynamically moved the active `WebContentsView` below the measured suggestion overlay and restored its normal position as soon as the overlay closes.

### Tests

- Added Electron E2E coverage that compares the real native view bounds against the rendered suggestion list and verifies the view returns to the normal chrome boundary.

## 1.1.6 - Browser Basics, Shortcuts, Find, and Bookmark Import

### Added

- Added editable, persisted browser shortcuts with conflict detection, safe reserved-key validation, per-action reset, and full reset.
- Added `Ctrl+Shift+T` closed-tab restoration with an in-memory 25-tab history.
- Added a native Chromium find-in-page bar with next/previous match navigation, match count, case sensitivity, and Escape handling.
- Added Netscape bookmark HTML import with folder preservation, duplicate handling, unsafe URL rejection, size limits, import summaries, and HTML export.
- Added middle-click tab closing without activating the target tab.

### Fixed

- Kept Google search functional when the unused custom search template is empty.
- Added clear validation when Custom search is selected without a valid `{query}` or `%s` HTTP(S) template.
- Unified shell and web-content shortcut handling through one typed shortcut registry.

### Tests

- Added unit coverage for shortcut normalization/conflicts and secure bookmark parsing/merging.
- Added Electron E2E coverage for search validation, closed-tab restoration, middle-click close, find-in-page, shortcut editing, and bookmark import.

## 1.1.5 - Tab Context Menu Layering Patch

### Fixed

- Rendered the tab context menu on the top-level overlay layer so it no longer appears behind the address bar or other browser chrome.
- Preserved every tab context-menu action and the existing UltraX styling while escaping the tab strip's backdrop-filter stacking context.

### Tests

- Added E2E coverage for the real address-bar overlap and verified that context-menu actions remain clickable.

## 1.1.4 - Chrome Overlay Layering Patch

### Fixed

- Moved tab hover previews below the full browser chrome so they no longer sit behind or collide with the address/search bar.
- Raised address-bar suggestion dropdown layering above tab preview overlays.

### Tests

- Added E2E coverage to ensure tab hover previews render below the browser chrome content boundary.

## 1.1.3 - Tab Tooltip Patch

### Fixed

- Removed the native Chromium tab title tooltip that could appear as a large floating rectangle over the browser chrome.
- Preserved tab accessibility labels through `aria-label` while keeping the custom UltraX tab hover preview.
- Closed pending tab hover previews when starting tab drag interactions to avoid overlapping hover and drag states.

### Tests

- Added E2E coverage to ensure browser tabs no longer expose native `title` tooltips while keeping readable labels.

## 1.1.2 - Settings, Privacy, Security, Accessibility, and Tab Preview Update

### Added

- Expanded Accessibility with motion, animation level, contrast, reduced transparency, focus ring visibility, text size, toolbar tab navigation, link underlines, font smoothing, and New Tab visual comfort controls.
- Built a real Permissions center with default policies for camera, microphone, location, notifications, clipboard, downloads, and pop-ups, plus site-specific exceptions.
- Added controlled Electron permission prompts with Allow/Block decisions and optional remembered site exceptions for supported web permissions.
- Added tab hover previews with title, URL, favicon/loading state, pinned state, and audio/mute metadata.
- Added privacy controls for browsing data, Do Not Track, third-party-cookie preference storage, cleanup-on-close, and settings export.
- Added security controls and status sections for HTTPS upgrades, dangerous download warnings, extension permission review, remote extension trust, and Electron isolation posture.

### Changed

- Fresh installs now default to Google search, an empty custom search template, Google online suggestions enabled, Home behavior set to New Tab, and saved Home URL `https://google.com`.
- Schemeless domain navigation now respects the secure-connections setting while keeping localhost/IP targets on HTTP.
- Extension enable/install confirmations now respect the review-extension-permissions setting.

### Security

- Dangerous executable download types now require user confirmation before saving.
- Pop-up handling now follows the saved pop-up permission policy instead of always opening safe window requests as tabs.
- Electron security remains strict: `contextIsolation`, `sandbox`, and `webSecurity` stay enabled.

### Tests

- Added E2E coverage for v1.1.2 fresh defaults, accessibility/permission persistence, and tab hover preview appearance/dismissal.

## 1.1.1 - Extensions Folder Auto-Creation Patch

### Fixed

- Added automatic creation of the UltraX extensions workspace under the Electron `userData` directory.
- Created the required `installed`, `unpacked`, `samples`, `storage`, and `logs` subfolders without deleting or overwriting existing extension data.
- Updated Open Extensions Folder, Load Unpacked Extension, Validate Extension Folder, local Store actions, extension APIs, and extension logging paths to ensure the workspace exists first.
- Load and validate dialogs now start in `userData/extensions/unpacked` instead of relying on a missing or relative folder.
- Added a safe renderer IPC method for ensuring the extensions workspace without exposing arbitrary filesystem access.

## 1.1.0 - Tab Drag Stability and Polish

### Improved

- Replaced native HTML tab dragging with a controlled pointer-drag system to remove duplicate drag previews, stacked labels, and unstable tab overlap.
- Added a stable tab drag placeholder and a single elevated floating drag preview with clean layering below context menus.
- Normal tabs and pinned tabs now render as separate drag groups, keeping pinned tabs on the left and preventing cross-group visual mixing.
- Tab reordering now supports explicit before/after placement so drops at the end of a tab group settle correctly.
- Empty chrome remains draggable while tabs, close buttons, context menus, and window controls stay in no-drag regions.

### Tests

- Added Playwright coverage for pointer-based tab dragging, pinned tab reordering, and pinned/normal boundary stability.

## 1.0.9 - Stability and Browser UX Update

### Added

- Added real Move Tab to New Window behavior from the tab context menu.
- Added a multi-window session model with per-window tab lists, active tab IDs, pinned tab order, and window bounds.
- Added Mute Tab / Unmute Tab runtime controls backed by Electron `webContents.setAudioMuted`.
- Added muted and audio-playing indicators in the tab strip.
- Added Playwright/E2E coverage for tab UX, settings persistence, and the Updates page smoke path.
- Added E2E-safe user data isolation through `ULTRAX_E2E_USER_DATA`.

### Improved

- Browser IPC now dispatches by trusted window sender so multiple UltraX windows can operate at the same time.
- Session persistence now updates the current window session without overwriting other window sessions.
- Windows package metadata now includes stronger publisher/executable metadata and SHA256-only signing hash configuration.
- Signing and release trust documentation now covers normal vs EV certificates, false positive submission, verification, and reputation building.

### Known Limitations

- Moving tabs between already-open UltraX windows is prepared by the session model but does not have UI in v1.0.9.
- Dragging a tab out of the strip to detach is intentionally not enabled yet; context-menu Move Tab to New Window is the stable path.
- A moved tab reloads from its URL in the new window instead of transferring live WebContents history/DOM state, because Electron WebContents cannot be safely owned by two windows.
- Windows builds remain unsigned until real signing secrets/certificates are configured in GitHub Actions.

## 1.0.8 - Browser UX, Appearance, and Tab Management

### Added

- Added the `When closing UltraX` setting with restore, ask, and discard session behavior.
- Added an UltraX-designed close confirmation dialog for real close-risk cases.
- Added pinned tabs, tab drag-and-drop reordering, and persisted pinned/tab order state.
- Added a custom tab context menu with New Tab, Reload, Duplicate, Pin/Unpin, Close, Close Other Tabs, and Close Tabs to the Right.
- Added expanded Appearance controls for interface density, corner radius, glass blur, panel transparency, animation level, New Tab backgrounds, shader presets, intensity, and speed.
- Added New Tab backgrounds for UltraX Wave, Aurora, Gradient Mesh, Minimal Dark, Solid Color, and local Custom Image.

### Improved

- Closing with session restore no longer shows the old native Windows confirmation prompt.
- Empty browser chrome areas now use proper frameless drag regions while controls remain clickable.
- New Tab shader settings now affect shader preset color direction and speed.
- Custom New Tab images are selected through a safe main-process file dialog and copied into UltraX user data.

### Known Limitations

- Move Tab to New Window is prepared as a disabled context menu action for v1.0.8; full multi-window WebContentsView ownership is planned for a later update.
- Mute Site is visible as a disabled context menu placeholder until per-site audio state is wired.

## 1.0.7 - Search Suggestions and Release Trust QoL

### Added

- Added address bar suggestions for direct URLs, searches, open tabs, bookmarks, and local history.
- Added keyboard navigation for suggestions with arrow keys, Enter, Escape, and Tab completion.
- Added privacy-controlled online suggestions for Google and DuckDuckGo, disabled by default.
- Added persisted search suggestion settings for local, history, bookmark, open-tab, online, and provider controls.
- Added Windows signing documentation and a release trust checklist.
- Added SHA256 checksum generation for release artifacts.

### Improved

- Updated visible app metadata to UltraX Browser 1.0.7.
- Improved Windows installer metadata, publisher metadata, artifact naming, and per-user install behavior.
- Reduced unnecessary installer elevation by keeping normal installs asInvoker/per-user.
- Updated release workflow checks for the new installer naming and checksum uploads.

### Security

- Online suggestions send only the typed query to the selected provider and never send history, bookmarks, or tab data.
- Online suggestions remain off by default and are suppressed when Do Not Track is enabled.
- Release trust work avoids antivirus bypasses, packers, obfuscation, or security-disabling behavior.

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

### Recommended Next Steps for Later Releases

- Add a real extension/plugin subsystem.
- Add auto-update infrastructure and signed Windows releases.
- Add per-site permission management and profile storage.
