const api = typeof browser !== "undefined" ? browser : chrome;

const isYouTubeWatchUrl = (url) => {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com")) &&
      parsed.pathname === "/watch"
    );
  } catch {
    return false;
  }
};

const isKickUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "kick.com" || parsed.hostname.endsWith(".kick.com");
  } catch {
    return false;
  }
};

api.action.onClicked.addListener((tab) => {
  if (!tab?.id || !tab.url || (!isYouTubeWatchUrl(tab.url) && !isKickUrl(tab.url))) {
    return;
  }

  api.tabs.sendMessage(tab.id, { type: "SYNC_TIME" });
});
