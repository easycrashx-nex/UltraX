# UltraX Browser 1.2.1

Internal version: `1.2.1`.

Release tag: `v1.2.1`.

## Twitch shutdown crash fix

- Fixed a main-process JavaScript error when closing UltraX while Twitch or another audio page was active.
- Late audio state events are now ignored when their WebContents is destroyed, detached, disposed, or no longer belongs to an open tab.
- Mute, tab move, New Tab conversion, title updates, navigation updates, and browser disposal now guard destroyed WebContents consistently.

This patch does not change browser security settings or the existing Twitch/media behavior while the browser remains open.
