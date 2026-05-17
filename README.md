# Video Time URL Sync

Userscript that lets you manually sync the `t` query parameter in supported video URLs with the current playback time. Click the in-page sync button to update the URL; copying the link will then preserve your position without refreshing the page.

## How it works
- Runs on YouTube and Kick pages through a userscript manager.
- Adds a compact bottom-center control with a sync button and the current URL `t` value.
- When you click the sync button, it reads the active video playback time and updates the URL's `t` param in-place via `history.replaceState`.
- On YouTube watch and live pages with live chat, it hides the side chat on page load.
- On Kick VOD pages, it also unmutes the player, closes the chat sidebar, and enables theater mode on page load.

## Install
1. Install a userscript manager such as Violentmonkey, Tampermonkey, or Greasemonkey.
2. Open the userscript URL:
   `https://raw.githubusercontent.com/evan6seven/youtube-time-url-sync/main/userscript/video-time-url-sync.user.js`
3. Confirm the install in your userscript manager.
4. Navigate to a supported page. The page button updates the `t` param, and the display shows the current `t` value from the URL.

## Notes
- YouTube support is limited to standard `/watch` pages, including live streams with DVR. Shorts are ignored.
- Kick support targets VOD pages and channel pages with an active HTML5 video player.
- The userscript lives at `userscript/video-time-url-sync.user.js`.

## License
MIT License. See `LICENSE` for details.
