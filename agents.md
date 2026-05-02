# Agents Guide

Project: userscript that syncs supported video URLs' `t` parameter with the current playback time.

Key points
- Target: YouTube watch pages and Kick pages matched by the userscript metadata.
- Behavior: Does not auto-sync time. Clicking the in-page sync button sets `t` to the current playback time via `history.replaceState`.
- UI: The userscript adds a compact bottom-center control with a sync button and URL time display.
- Kick VOD behavior: On `/.../videos/...` pages, the userscript closes the chat sidebar and enables theater mode on page load/navigation. The sync button must not toggle chat or theater mode.
- Skips: YouTube Shorts are ignored implicitly because path `/watch` is required; YouTube live streams with DVR are supported.

Dev notes
- Userscript implementation is in `userscript/video-time-url-sync.user.js`.
- Install URL: `https://raw.githubusercontent.com/evan6seven/youtube-time-url-sync/main/userscript/video-time-url-sync.user.js`
- Keep this project userscript-only; do not add browser extension manifests, background scripts, content scripts, or packaged extension assets.
