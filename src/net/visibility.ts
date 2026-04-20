import {
  serverUrl,
  currentChannel,
  currentThread,
  loadedChannelsByServer,
  reachedOldestByServer,
  wsConnections,
  serverCapabilitiesByServer,
  myStatus,
  autoIdleOnUnfocus,
  savedStatusText,
  isSpecialChannel,
  unreadState,
} from "../state";
import { wsSend, startMessageFetch } from "../lib/ws-sender";

let visibilityHandler: (() => void) | null = null;
let autoIdleActive = false;
let idleDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_DEBOUNCE_MS = 500;

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new window.AudioContext();
  }
  return audioCtx;
}

export function cleanupAudioContext(): void {
  if (audioCtx && audioCtx.state !== "closed") {
    audioCtx.close();
    audioCtx = null;
  }
}

function refreshCurrentChannel(): void {
  const sUrl = serverUrl.value;
  const channel = currentChannel.value;
  if (!sUrl || !channel || isSpecialChannel(channel.name, sUrl)) return;
  const conn = wsConnections[sUrl];
  if (conn?.status !== "connected") return;
  const threadId = currentThread.value?.id;
  if (threadId) {
    loadedChannelsByServer[sUrl]?.delete(threadId);
    reachedOldestByServer[sUrl]?.delete(threadId);
    startMessageFetch(sUrl, threadId);
    wsSend({ cmd: "messages_get", channel: channel.name, thread_id: threadId, limit: 30 }, sUrl);
  } else {
    loadedChannelsByServer[sUrl]?.delete(channel.name);
    reachedOldestByServer[sUrl]?.delete(channel.name);
    startMessageFetch(sUrl, channel.name);
    wsSend({ cmd: "messages_get", channel: channel.name, limit: 30 }, sUrl);
  }
}

export function setupVisibilityHandler(): void {
  if (visibilityHandler) return;
  visibilityHandler = () => {
    if (autoIdleOnUnfocus.value) {
      if (document.hidden) {
        if (idleDebounceTimer) clearTimeout(idleDebounceTimer);
        idleDebounceTimer = setTimeout(() => {
          if (!autoIdleOnUnfocus.value) return;
          if (!document.hidden) return;
          if (myStatus.value.status === "online") {
            autoIdleActive = true;
            const currentText = myStatus.value.text;
            myStatus.value = { status: "idle", text: currentText };
            for (const sUrl of Object.keys(wsConnections)) {
              const caps = serverCapabilitiesByServer.read(sUrl) || [];
              if (caps.includes("status_set")) {
                wsSend({ cmd: "status_set", status: "idle", text: currentText }, sUrl);
              }
            }
          }
          idleDebounceTimer = null;
        }, IDLE_DEBOUNCE_MS);
      } else {
        if (idleDebounceTimer) {
          clearTimeout(idleDebounceTimer);
          idleDebounceTimer = null;
        }
        if (autoIdleActive && myStatus.value.status === "idle") {
          autoIdleActive = false;
          myStatus.value = { status: "online", text: savedStatusText.value };
          for (const sUrl of Object.keys(wsConnections)) {
            const caps = serverCapabilitiesByServer.read(sUrl) || [];
            if (caps.includes("status_set")) {
              wsSend({ cmd: "status_set", status: "online", text: savedStatusText.value }, sUrl);
            }
          }
        }
      }
    }
    if (!document.hidden) {
      const sUrl = serverUrl.value;
      const ch = currentChannel.value;
      if (sUrl && ch && !isSpecialChannel(ch.name, sUrl)) {
        const key = currentThread.value ? `thread:${currentThread.value.id}` : ch.name;
        unreadState.clearChannel(sUrl, key);
      }
      refreshCurrentChannel();
    }
  };
  document.addEventListener("visibilitychange", visibilityHandler);
}

export function cleanupVisibilityHandler(): void {
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
  if (idleDebounceTimer) {
    clearTimeout(idleDebounceTimer);
    idleDebounceTimer = null;
  }
  autoIdleActive = false;
  cleanupAudioContext();
}
