# UltraX Browser 1.2.3

Internal version: `1.2.3`.

Release tag: `v1.2.3`.

## WebContentsView fullscreen fallback

- Fixed fullscreen requests from YouTube, Twitch, and other HTML5 media pages when Electron does not forward the native HTML fullscreen event.
- Added a narrow, sender-validated `fullscreenchange` bridge in the isolated page preload.
- Fullscreen still expands the active page over the browser chrome and restores the normal layout when it ends.
