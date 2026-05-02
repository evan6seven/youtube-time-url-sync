const isYouTubeHost = (hostname) =>
  hostname === "youtube.com" || hostname.endsWith(".youtube.com");

const isKickHost = (hostname) =>
  hostname === "kick.com" || hostname.endsWith(".kick.com");

const isKickSyncablePath = (pathname) =>
  /^\/video\/[^/]+\/?$/.test(pathname) ||
  /^\/[^/]+\/videos\/[^/]+\/?$/.test(pathname) ||
  /^\/[^/]+\/?$/.test(pathname);

const isKickVideosPath = (pathname) => /^\/[^/]+\/videos\/[^/]+\/?$/.test(pathname);

const isSyncablePage = () => {
  const { hostname, pathname } = window.location;

  if (isYouTubeHost(hostname)) {
    return pathname === "/watch";
  }

  if (isKickHost(hostname)) {
    return isKickSyncablePath(pathname);
  }

  return false;
};

const getVideoElement = () => {
  if (isYouTubeHost(window.location.hostname)) {
    return document.querySelector("video.html5-main-video");
  }

  if (isKickHost(window.location.hostname)) {
    return document.querySelector("video");
  }

  return null;
};

const nativeReplaceState = History.prototype.replaceState;
const kickVodActions = new Map();

const syncTimeToUrl = () => {
  if (!isSyncablePage()) return;
  const video = getVideoElement();
  if (!video) return;
  if (!Number.isFinite(video.currentTime) || video.currentTime < 0) return;

  const seconds = Math.max(0, Math.floor(video.currentTime));
  const url = new URL(window.location.href);
  const existing = parseInt(url.searchParams.get("t"), 10);
  if (Number.isFinite(existing) && existing === seconds) return;

  url.searchParams.set("t", String(seconds));
  nativeReplaceState.call(history, history.state, "", `${url.pathname}${url.search}${url.hash}`);
};

const getKickVodActionState = () => {
  const key = `${window.location.pathname}${window.location.search}`;
  const state = kickVodActions.get(key) ?? { chatClosed: false, theaterMode: false };
  kickVodActions.set(key, state);
  return state;
};

const findKickChatToggleButton = () => {
  const buttons = document.querySelectorAll("button");

  for (const button of buttons) {
    if (button.textContent?.trim() === "Chat") return button;
  }

  return null;
};

const clickKickVodPlayerControls = () => {
  if (!isKickHost(window.location.hostname) || !isKickVideosPath(window.location.pathname)) return;

  const state = getKickVodActionState();

  if (!state.chatClosed && document.body.textContent?.includes("Chat Replay")) {
    const chatToggleButton = findKickChatToggleButton();
    if (chatToggleButton) {
      chatToggleButton.click();
      state.chatClosed = true;
    }
  }

  if (!state.theaterMode) {
    const theaterModeButton = document.querySelector('[data-testid="video-player-theatre-mode"]');
    if (theaterModeButton instanceof HTMLElement) {
      theaterModeButton.click();
      state.theaterMode = true;
    }
  }
};

const watchForKickVideos = () => {
  clickKickVodPlayerControls();

  const observer = new MutationObserver(clickKickVodPlayerControls);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("popstate", clickKickVodPlayerControls);
};

watchForKickVideos();

const runtime = typeof browser !== "undefined" ? browser.runtime : chrome?.runtime;
if (runtime) {
  runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "SYNC_TIME") {
      syncTimeToUrl();
      sendResponse?.({ ok: true });
    }
  });
}
