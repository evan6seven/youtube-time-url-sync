// ==UserScript==
// @name         Video Time URL Sync
// @namespace    https://github.com/evan6seven/youtube-time-url-sync
// @version      1.2.5
// @description  Adds an in-page button to sync supported video URLs' t= parameter with the current playback time.
// @author       evfrenkel
// @match        *://youtube.com/*
// @match        *://*.youtube.com/*
// @match        *://kick.com/*
// @match        *://*.kick.com/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/evan6seven/youtube-time-url-sync/main/userscript/video-time-url-sync.user.js
// @updateURL    https://raw.githubusercontent.com/evan6seven/youtube-time-url-sync/main/userscript/video-time-url-sync.user.js
// ==/UserScript==

(() => {
  "use strict";

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

  const nativePushState = History.prototype.pushState;
  const nativeReplaceState = History.prototype.replaceState;
  const kickVodActions = new Map();
  const log = (...args) => console.info("[Video Time URL Sync]", ...args);

  const formatSeconds = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "none";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const getUrlTime = () => {
    const url = new URL(window.location.href);
    const rawTime = url.searchParams.get("t");
    const seconds = parseInt(rawTime, 10);

    return Number.isFinite(seconds) && seconds >= 0
      ? { rawTime, seconds }
      : { rawTime: null, seconds: null };
  };

  const syncTimeToUrl = () => {
    if (!isSyncablePage()) return false;
    const video = getVideoElement();
    if (!video) return false;
    if (!Number.isFinite(video.currentTime) || video.currentTime < 0) return false;

    const seconds = Math.max(0, Math.floor(video.currentTime));
    const url = new URL(window.location.href);
    const existing = parseInt(url.searchParams.get("t"), 10);
    if (Number.isFinite(existing) && existing === seconds) return true;

    url.searchParams.set("t", String(seconds));
    nativeReplaceState.call(history, history.state, "", `${url.pathname}${url.search}${url.hash}`);
    return true;
  };

  const getKickVodActionState = () => {
    const key = window.location.pathname;
    const state = kickVodActions.get(key) ?? {
      chatClosed: false,
      lastChatCloseClick: 0,
      lastUnmuteClick: 0,
      theaterMode: false,
    };
    kickVodActions.set(key, state);
    return state;
  };

  const findKickChatCloseControl = () => {
    const controls = document.querySelectorAll('button, [role="button"]');

    for (const control of controls) {
      if (control.textContent?.trim() === "Chat") continue;

      const closeChatPath = control.querySelector('path[d^="M23.2095 18.3328"]');
      if (closeChatPath) return control;
    }

    return null;
  };

  const getVisibleKickChatReplayHeader = () => {
    const candidates = document.querySelectorAll("h1, h2, h3, h4, [role='heading'], div, span");

    for (const candidate of candidates) {
      if (candidate.textContent?.trim() !== "Chat Replay") continue;

      const rect = candidate.getBoundingClientRect();
      const style = window.getComputedStyle(candidate);
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0
      ) {
        return candidate;
      }
    }

    return null;
  };

  const getKickChatStateRoot = () => {
    const chatRoom = document.querySelector("#channel-chatroom");
    const chatStateRoot = chatRoom?.closest?.("[data-chat]");
    if (chatStateRoot) return chatStateRoot;

    return document.querySelector("[data-chat]");
  };

  const getKickChatSignals = () => {
    const chatStateRoot = getKickChatStateRoot();
    const dataChat = chatStateRoot?.getAttribute("data-chat") ?? null;
    const visibleHeader = getVisibleKickChatReplayHeader();

    return {
      chatStateRoot,
      dataChat,
      isOpen: dataChat === null ? Boolean(visibleHeader) : dataChat === "true",
      visibleHeader,
    };
  };

  const findKickChatCloseControlNearHeader = () => {
    const header = getVisibleKickChatReplayHeader();
    if (!header) return null;

    const rect = header.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const xOffsets = [24, 48, 72, 96, 120, 144];

    for (const offset of xOffsets) {
      const x = rect.left - offset;
      if (x < 0) continue;

      const elements = document.elementsFromPoint(x, y);
      for (const element of elements) {
        const control = element.closest?.('button, [role="button"]');
        if (!control || control.textContent?.trim() === "Chat") continue;
        return control;
      }
    }

    return null;
  };

  const findKickChatCloseControlForOpenSidebar = () => {
    return findKickChatCloseControl() ?? findKickChatCloseControlNearHeader();
  };

  const clickKickVolumeControl = (video) => {
    const rect = video.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const clientX = rect.left + 72;
    const clientY = rect.bottom - 23;
    const mouseMove = new MouseEvent("mousemove", { bubbles: true, clientX, clientY });

    video.dispatchEvent(mouseMove);
    document.dispatchEvent(mouseMove);

    const clickButtonAtPoint = () => {
      if (!video.muted) return true;
      const target = document.elementFromPoint(clientX, clientY);
      const volumeButton = target?.closest?.("button");
      if (!volumeButton) return false;

      volumeButton.click();
      return true;
    };

    if (clickButtonAtPoint()) return true;

    window.setTimeout(clickButtonAtPoint, 100);
    return true;
  };

  const clickKickVodPlayerControls = () => {
    if (!isKickHost(window.location.hostname) || !isKickVideosPath(window.location.pathname)) return;

    const state = getKickVodActionState();
    const video = getVideoElement();

    if (video?.muted && Date.now() - state.lastUnmuteClick > 1000) {
      if (clickKickVolumeControl(video)) {
        state.lastUnmuteClick = Date.now();
        log("clicked Kick volume control");
      }
    }

    if (!state.chatClosed) {
      const chatSignals = getKickChatSignals();
      if (!chatSignals.isOpen) {
        state.chatClosed = true;
        log("Kick chat sidebar already closed", {
          dataChat: chatSignals.dataChat,
          visibleHeader: Boolean(chatSignals.visibleHeader),
        });
      } else if (Date.now() - state.lastChatCloseClick > 1000) {
        const chatCloseControl = findKickChatCloseControlForOpenSidebar();
        if (!chatCloseControl) {
          log("Kick chat sidebar open, but close control not found", {
            dataChat: chatSignals.dataChat,
            visibleHeader: Boolean(chatSignals.visibleHeader),
          });
        } else {
          chatCloseControl.click();
          state.lastChatCloseClick = Date.now();
          log("clicked Kick chat close control", {
            dataChat: chatSignals.dataChat,
            visibleHeader: Boolean(chatSignals.visibleHeader),
          });

          window.setTimeout(() => {
            const updatedChatSignals = getKickChatSignals();
            if (!updatedChatSignals.isOpen) {
              state.chatClosed = true;
              log("Kick chat sidebar closed", {
                dataChat: updatedChatSignals.dataChat,
                visibleHeader: Boolean(updatedChatSignals.visibleHeader),
              });
            } else {
              log("Kick chat sidebar still open after close click", {
                dataChat: updatedChatSignals.dataChat,
                visibleHeader: Boolean(updatedChatSignals.visibleHeader),
              });
            }
          }, 500);
        }
      }
    }

    if (!state.theaterMode) {
      const theaterModeButton = document.querySelector('[data-testid="video-player-theatre-mode"]');
      if (theaterModeButton instanceof HTMLElement) {
        theaterModeButton.click();
        state.theaterMode = true;
        log("clicked Kick theater mode control");
      }
    }
  };

  const createWidget = () => {
    const widget = document.createElement("div");
    widget.id = "video-time-url-sync";
    widget.innerHTML = `
      <button type="button" class="vtus-button" aria-label="Sync URL time" title="Sync URL time">↻</button>
      <span class="vtus-display" aria-live="polite"></span>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #video-time-url-sync {
        position: fixed;
        left: 50%;
        bottom: 16px;
        transform: translateX(-50%);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        color: #f8fafc;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.45);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        font: 12px/1.3 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #video-time-url-sync[hidden] {
        display: none;
      }

      #video-time-url-sync .vtus-button {
        width: 30px;
        min-height: 30px;
        padding: 0;
        color: #0f172a;
        background: #f8fafc;
        border: 0;
        border-radius: 6px;
        font: 20px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-weight: 700;
        cursor: pointer;
      }

      #video-time-url-sync .vtus-button:hover {
        background: #e2e8f0;
      }

      #video-time-url-sync .vtus-button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      #video-time-url-sync .vtus-display {
        min-width: 62px;
        white-space: nowrap;
      }
    `;

    document.documentElement.append(style, widget);
    return widget;
  };

  const widget = createWidget();
  const button = widget.querySelector(".vtus-button");
  const display = widget.querySelector(".vtus-display");

  const updateWidget = () => {
    const syncable = isSyncablePage();
    const { rawTime, seconds } = getUrlTime();

    widget.hidden = !syncable;
    button.disabled = !syncable;
    display.textContent = rawTime === null ? "none" : `${rawTime} (${formatSeconds(seconds)})`;
  };

  button.addEventListener("click", () => {
    syncTimeToUrl();
    updateWidget();
  });

  const handleUrlChange = () => {
    updateWidget();
    clickKickVodPlayerControls();
  };

  History.prototype.pushState = function pushState(...args) {
    const result = nativePushState.apply(this, args);
    window.dispatchEvent(new Event("video-time-url-sync:urlchange"));
    return result;
  };

  History.prototype.replaceState = function replaceState(...args) {
    const result = nativeReplaceState.apply(this, args);
    window.dispatchEvent(new Event("video-time-url-sync:urlchange"));
    return result;
  };

  const observer = new MutationObserver(clickKickVodPlayerControls);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("popstate", handleUrlChange);
  window.addEventListener("video-time-url-sync:urlchange", handleUrlChange);
  window.addEventListener("yt-navigate-finish", handleUrlChange);

  updateWidget();
  clickKickVodPlayerControls();
})();
