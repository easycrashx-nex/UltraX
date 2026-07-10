# UltraX Browser v1.1.8

## Scrollable tabs

Normal tabs now keep a readable minimum width and scroll horizontally when the
strip overflows. Pinned tabs, overflow controls, the New Tab button, and window
controls remain fixed. The active tab is brought into view, wheel and touchpad
input stay local to the strip, and drag reordering supports edge auto-scroll.
The new All Tabs menu provides compact search, activate, pin, mute, and close
actions.

## Secure local password manager

Passwords & Autofill adds an UltraX-owned local encrypted vault with:

- master-password setup and rate-limited unlock
- AES-256-GCM authenticated encryption and memory-hard scrypt key derivation
- optional operating-system-backed quick unlock when securely available
- redacted login search, create, edit, duplicate, delete, favorite, and tags
- cryptographically secure password generation
- explicit exact-origin HTTPS fill into the active top-level page
- password clipboard auto-clear that preserves newer clipboard content
- local-only password health checks
- warned CSV import and authenticated encrypted backup import/export
- auto-lock on timeout, application close, screen lock, and suspend

Websites, extensions, and plugins do not receive vault APIs. Stored passwords are
not returned by list calls. Automatic form capture and save/update prompts remain
disabled in this release because UltraX does not yet have a dedicated isolated
content bridge that meets the v1.1.8 threat model.

## Release trust

The Windows build is currently unsigned and may trigger SmartScreen. Verify the
SHA256 checksum published with the GitHub Release. This release has undergone
project security review and automated testing, not an independent security audit.
