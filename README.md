# Video Time URL Sync

Firefox extension that lets you manually sync the `t` query parameter in supported video URLs with the current playback time. Click the toolbar icon while on a supported page to update the URL; copying the link will then preserve your position without refreshing the page.

## How it works
- Runs a content script on YouTube and Kick pages.
- When you click the extension icon, it reads the current playback time of the active video and updates the URL's `t` param in-place via `history.replaceState`.

## Install for development
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select this folder's `manifest.json`.
4. Navigate to a supported page, start playback, then click the extension icon to update the `t` param.

## Install the userscript
1. Install a userscript manager such as Violentmonkey, Tampermonkey, or Greasemonkey.
2. Open the userscript URL:
   `https://raw.githubusercontent.com/evan6seven/youtube-time-url-sync/main/userscript/video-time-url-sync.user.js`
3. Confirm the install in your userscript manager.
4. Navigate to a supported page. The page button updates the `t` param, and the display shows the current `t` value from the URL.

## Notes
- YouTube support is limited to standard `/watch` pages, including live streams with DVR. Shorts are ignored.
- Kick support targets VOD pages and channel pages with an active HTML5 video player.
- The userscript version lives at `userscript/video-time-url-sync.user.js`.

## License
MIT License. See `LICENSE` for details.
