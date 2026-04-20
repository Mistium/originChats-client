import type { MessagesAround } from "@/msgTypes";
import {
  messageState,
  getMessageKey,
  normalizeReactions,
  mergeAndSortMessages,
  loadedChannelsByServer,
  reachedOldestByServer,
  reachedNewestByServer,
} from "../../../state";
import { finishMessageFetch } from "../../ws-sender";
import { renderMessagesSignal } from "../../ui-signals";

const pendingJumpByServer: Record<string, { messageId: string; channel: string } | null> = {};
const olderLoadPendingByServer: Record<string, Set<string>> = {};
const newerLoadPendingByServer: Record<string, Set<string>> = {};

export function setPendingJump(sUrl: string, messageId: string, channel: string): void {
  pendingJumpByServer[sUrl] = { messageId, channel };
}

function clearPendingJump(sUrl: string): void {
  pendingJumpByServer[sUrl] = null;
}

export function setPendingOlderLoad(sUrl: string, channel: string): void {
  if (!olderLoadPendingByServer[sUrl]) {
    olderLoadPendingByServer[sUrl] = new Set();
  }
  olderLoadPendingByServer[sUrl].add(channel);
}

export function setPendingNewerLoad(sUrl: string, channel: string): void {
  if (!newerLoadPendingByServer[sUrl]) {
    newerLoadPendingByServer[sUrl] = new Set();
  }
  newerLoadPendingByServer[sUrl].add(channel);
}

export function handleMessagesAround(msg: MessagesAround, sUrl: string): void {
  const messageKey = getMessageKey(msg);
  finishMessageFetch(sUrl, messageKey);

  if (!loadedChannelsByServer[sUrl]) loadedChannelsByServer[sUrl] = new Set();
  loadedChannelsByServer[sUrl].add(messageKey);

  const existingMsgs = messageState.get(sUrl, messageKey);
  const isOlderLoad = olderLoadPendingByServer[sUrl]?.has(messageKey);
  const isNewerLoad = newerLoadPendingByServer[sUrl]?.has(messageKey);

  if (isOlderLoad) {
    olderLoadPendingByServer[sUrl].delete(messageKey);
  }
  if (isNewerLoad) {
    newerLoadPendingByServer[sUrl].delete(messageKey);
  }

  const newMessages = normalizeReactions(msg.messages || []);
  const sortedMsgs = mergeAndSortMessages(existingMsgs, newMessages);
  const hasNewMessages =
    newMessages.length > 0 && newMessages.some((m) => !existingMsgs.some((e) => e.id === m.id));

  if (msg.range?.start === 0 || (isOlderLoad && newMessages.length === 0)) {
    if (!reachedOldestByServer[sUrl]) reachedOldestByServer[sUrl] = new Set();
    reachedOldestByServer[sUrl].add(messageKey);
  }

  if (
    (newMessages.length === 1 && msg.range?.start !== 0) ||
    (isNewerLoad && newMessages.length === 0)
  ) {
    if (!reachedNewestByServer[sUrl]) reachedNewestByServer[sUrl] = new Set();
    reachedNewestByServer[sUrl].add(messageKey);
  }

  if (!isOlderLoad && !isNewerLoad && sortedMsgs.length > 0) {
    if (!reachedNewestByServer[sUrl]) reachedNewestByServer[sUrl] = new Set();
    reachedNewestByServer[sUrl].add(messageKey);
  }

  if (isOlderLoad || isNewerLoad) {
    messageState.setRaw(sUrl, messageKey, sortedMsgs);
    if (!hasNewMessages) {
      renderMessagesSignal.value++;
    }
  } else {
    messageState.set(sUrl, messageKey, sortedMsgs);
  }

  const pendingJump = pendingJumpByServer[sUrl];
  if (pendingJump && pendingJump.channel === messageKey) {
    pendingJumpByServer[sUrl] = null;
    reachedOldestByServer[sUrl]?.delete(messageKey);
    reachedNewestByServer[sUrl]?.delete(messageKey);
    setTimeout(() => {
      const el = document.querySelector(`[data-msg-id="${pendingJump.messageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-flash");
        setTimeout(() => el.classList.remove("highlight-flash"), 2000);
      }
    }, 100);
  }
}
