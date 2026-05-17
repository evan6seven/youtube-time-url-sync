// ==UserScript==
// @name         Video Time URL Sync
// @namespace    https://github.com/evan6seven/youtube-time-url-sync
// @version      1.2.13
// @description  Adds an in-page button to sync supported video URLs' t= parameter with the current playback time.
// @author       evfrenkel
// @match        *://youtube.com/*
// @match        *://*.youtube.com/*
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @include      https://youtube.com/watch*
// @include      https://www.youtube.com/watch*
// @include      https://m.youtube.com/watch*
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

  const isYouTubeLiveChatPage = (pathname) =>
    pathname === "/watch" || /^\/live\/[^/]+\/?$/.test(pathname);

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
  const youTubeLiveChatActions = new Map();
  const log = (...args) => console.info("[Video Time URL Sync]", ...args);
  log("loaded", {
    href: window.location.href,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
  });

  if (window.top !== window.self) {
    log("skipping frame", {
      href: window.location.href,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
    });
    return;
  }

  const pageInteractionDelay = () => 2000 + Math.floor(Math.random() * 2001);

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
      pendingChatClose: false,
      pendingTheaterMode: false,
      pendingUnmute: false,
      theaterMode: false,
    };
    kickVodActions.set(key, state);
    return state;
  };

  const getYouTubeLiveChatActionState = () => {
    const key = `${window.location.pathname}?${new URLSearchParams(window.location.search).get("v") ?? ""}`;
    const state = youTubeLiveChatActions.get(key) ?? {
      chatClosed: false,
    };
    youTubeLiveChatActions.set(key, state);
    return state;
  };

  const getYouTubeLiveChatContainer = () => {
    return document.querySelector("ytd-watch-flexy #chat-container");
  };

  const ensureYouTubeLiveChatStyle = () => {
    const styleId = "video-time-url-sync-youtube-chat-style";
    let style = document.getElementById(styleId);

    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement("style");
      style.id = styleId;
      (document.head || document.documentElement).append(style);
    }

    style.textContent = `
      ytd-watch-flexy #chat-container {
        display: none !important;
      }
    `;
  };

  const hideYouTubeLiveChat = () => {
    if (!isYouTubeHost(window.location.hostname) || !isYouTubeLiveChatPage(window.location.pathname)) return;

    const state = getYouTubeLiveChatActionState();
    ensureYouTubeLiveChatStyle();

    const chatContainer = getYouTubeLiveChatContainer();
    if (chatContainer instanceof HTMLElement) {
      chatContainer.style.setProperty("display", "none", "important");
      chatContainer.setAttribute("data-video-time-url-sync-hidden", "true");
    }

    if (!state.chatClosed) {
      state.chatClosed = true;
      log("hid YouTube live chat container");
    }
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

  const getKickChatStateRoot = () => {
    const chatRoom = document.querySelector("#channel-chatroom");
    const chatStateRoot = chatRoom?.closest?.("[data-chat]");
    if (chatStateRoot) return chatStateRoot;

    return document.querySelector("[data-chat]");
  };

  const getKickChatSignals = () => {
    const chatStateRoot = getKickChatStateRoot();
    const dataChat = chatStateRoot?.getAttribute("data-chat") ?? null;

    return {
      chatStateRoot,
      dataChat,
      isOpen: dataChat === "true",
    };
  };

  const findKickChatCloseControlForOpenSidebar = () => {
    return findKickChatCloseControl();
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

    if (video?.muted && !state.pendingUnmute && Date.now() - state.lastUnmuteClick > 1000) {
      state.pendingUnmute = true;
      const delay = pageInteractionDelay();
      log("scheduled Kick volume control click", { delay });

      window.setTimeout(() => {
        state.pendingUnmute = false;
        const delayedVideo = getVideoElement();
        if (delayedVideo?.muted && clickKickVolumeControl(delayedVideo)) {
          state.lastUnmuteClick = Date.now();
          log("clicked Kick volume control");
        }
      }, delay);
    }

    if (!state.chatClosed) {
      const chatSignals = getKickChatSignals();
      if (chatSignals.dataChat === null) {
        log("Kick chat data-chat state not found");
      } else if (!chatSignals.isOpen) {
        state.chatClosed = true;
        log("Kick chat sidebar already closed", {
          dataChat: chatSignals.dataChat,
        });
      } else if (!state.pendingChatClose && Date.now() - state.lastChatCloseClick > 1000) {
        const chatCloseControl = findKickChatCloseControlForOpenSidebar();
        if (!chatCloseControl) {
          log("Kick chat sidebar open, but close control not found", {
            dataChat: chatSignals.dataChat,
          });
        } else {
          state.pendingChatClose = true;
          const delay = pageInteractionDelay();
          log("scheduled Kick chat close control click", {
            dataChat: chatSignals.dataChat,
            delay,
          });

          window.setTimeout(() => {
            state.pendingChatClose = false;
            const delayedChatSignals = getKickChatSignals();
            if (!delayedChatSignals.isOpen) {
              state.chatClosed = true;
              log("Kick chat sidebar already closed before delayed click", {
                dataChat: delayedChatSignals.dataChat,
              });
              return;
            }

            const delayedChatCloseControl = findKickChatCloseControlForOpenSidebar();
            if (!delayedChatCloseControl) {
              log("Kick chat sidebar open after delay, but close control not found", {
                dataChat: delayedChatSignals.dataChat,
              });
              return;
            }

            delayedChatCloseControl.click();
            state.lastChatCloseClick = Date.now();
            log("clicked Kick chat close control", {
              dataChat: delayedChatSignals.dataChat,
            });

            window.setTimeout(() => {
              const updatedChatSignals = getKickChatSignals();
              if (!updatedChatSignals.isOpen) {
                state.chatClosed = true;
                log("Kick chat sidebar closed", {
                  dataChat: updatedChatSignals.dataChat,
                });
              } else {
                log("Kick chat sidebar still open after close click", {
                  dataChat: updatedChatSignals.dataChat,
                });
              }
            }, 500);
          }, delay);
        }
      }
    }

    if (!state.theaterMode && !state.pendingTheaterMode) {
      const theaterModeButton = document.querySelector('[data-testid="video-player-theatre-mode"]');
      if (theaterModeButton instanceof HTMLElement) {
        state.pendingTheaterMode = true;
        const delay = pageInteractionDelay();
        log("scheduled Kick theater mode control click", { delay });

        window.setTimeout(() => {
          state.pendingTheaterMode = false;
          if (state.theaterMode) return;

          const delayedTheaterModeButton = document.querySelector('[data-testid="video-player-theatre-mode"]');
          if (delayedTheaterModeButton instanceof HTMLElement) {
            delayedTheaterModeButton.click();
            state.theaterMode = true;
            log("clicked Kick theater mode control");
          }
        }, delay);
      }
    }
  };

  const createWidget = () => {
    document.getElementById("video-time-url-sync")?.remove();
    document.getElementById("video-time-url-sync-style")?.remove();

    const widget = document.createElement("div");
    widget.id = "video-time-url-sync";

    const syncButton = document.createElement("button");
    syncButton.type = "button";
    syncButton.className = "vtus-button";
    syncButton.setAttribute("aria-label", "Sync URL time");
    syncButton.title = "Sync URL time";
    syncButton.textContent = "↻";

    const timeDisplay = document.createElement("span");
    timeDisplay.className = "vtus-display";
    timeDisplay.setAttribute("aria-live", "polite");

    widget.append(syncButton, timeDisplay);

    const style = document.createElement("style");
    style.id = "video-time-url-sync-style";
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
        padding: 0;
        color: #cbd5e1;
        background: rgba(15, 23, 42, 0.92);
        border: 0;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        font: 12px/1.3 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #video-time-url-sync.vtus-kick {
        top: 16px;
        bottom: auto;
      }

      #video-time-url-sync[hidden] {
        display: none;
      }

      #video-time-url-sync .vtus-button {
        width: 30px;
        min-height: 30px;
        padding: 0;
        color: #cbd5e1;
        background: transparent;
        border: 0;
        border-radius: 6px;
        font: 20px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-weight: 700;
        cursor: pointer;
      }

      #video-time-url-sync .vtus-button:hover {
        background: rgba(248, 250, 252, 0.12);
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

    const container = document.body || document.documentElement;
    container.append(style, widget);
    log("created widget", {
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      parent: container.tagName,
    });
    return widget;
  };

  let widget;
  let button;
  let display;

  const ensureWidget = () => {
    if (widget?.isConnected && button?.isConnected && display?.isConnected) return true;

    widget = createWidget();
    button = widget.querySelector(".vtus-button");
    display = widget.querySelector(".vtus-display");

    if (!(button instanceof HTMLButtonElement) || !(display instanceof HTMLElement)) {
      return false;
    }

    button.addEventListener("click", () => {
      syncTimeToUrl();
      updateWidget();
    });

    return true;
  };

  const updateWidget = () => {
    if (!ensureWidget()) {
      log("widget controls missing", {
        hostname: window.location.hostname,
        pathname: window.location.pathname,
      });
      return;
    }

    const syncable = isSyncablePage();
    const { rawTime, seconds } = getUrlTime();
    const isKickPage = isKickHost(window.location.hostname);

    widget.classList.toggle("vtus-kick", isKickPage);
    widget.hidden = !syncable;
    button.disabled = !syncable;
    display.textContent = rawTime === null ? "none" : `${rawTime} (${formatSeconds(seconds)})`;
    log("updated widget", {
      hidden: widget.hidden,
      hostname: window.location.hostname,
      isKickPage,
      pathname: window.location.pathname,
      syncable,
    });
  };

  const handleUrlChange = () => {
    updateWidget();
    hideYouTubeLiveChat();
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

  const handlePageMutation = () => {
    hideYouTubeLiveChat();
    clickKickVodPlayerControls();
  };

  const observer = new MutationObserver(handlePageMutation);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("popstate", handleUrlChange);
  window.addEventListener("load", updateWidget);
  window.addEventListener("video-time-url-sync:urlchange", handleUrlChange);
  window.addEventListener("yt-navigate-finish", handleUrlChange);

  try {
    updateWidget();
    hideYouTubeLiveChat();
    clickKickVodPlayerControls();
  } catch (error) {
    console.error("[Video Time URL Sync]", "startup failed", error);
  }
})();
