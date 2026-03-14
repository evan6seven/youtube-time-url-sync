const isYouTubeHost = (hostname) =>
  hostname === "youtube.com" || hostname.endsWith(".youtube.com");

const isKickHost = (hostname) =>
  hostname === "kick.com" || hostname.endsWith(".kick.com");

const isKickSyncablePath = (pathname) =>
  /^\/video\/[^/]+\/?$/.test(pathname) ||
  /^\/[^/]+\/videos\/[^/]+\/?$/.test(pathname) ||
  /^\/[^/]+\/?$/.test(pathname);

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

const runtime = typeof browser !== "undefined" ? browser.runtime : chrome?.runtime;
if (runtime) {
  runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "SYNC_TIME") {
      syncTimeToUrl();
      sendResponse?.({ ok: true });
    }
  });
}
