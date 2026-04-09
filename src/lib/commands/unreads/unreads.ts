import type {
  UnreadsGet,
  UnreadsCount,
  UnreadsAck,
  UnreadsUpdate,
} from "@/msgTypes";
import { unreadState } from "../../state/unread";

export function handleUnreadsGet(msg: UnreadsGet, sUrl: string): void {
  // Update unread state based on server response
  for (const [channel, info] of Object.entries(msg.unreads)) {
    if (info.unread_count > 0) {
      unreadState.setUnread(sUrl, channel, info.unread_count);
    } else {
      unreadState.clearChannel(sUrl, channel);
    }
  }
}

export function handleUnreadsCount(msg: UnreadsCount, sUrl: string): void {
  const key = msg.thread_id || msg.channel;
  if (!key) return;
  
  if (msg.unread_count > 0) {
    if (msg.thread_id) {
      unreadState.setUnread(sUrl, `thread:${msg.thread_id}`, msg.unread_count);
    } else {
      unreadState.setUnread(sUrl, key, msg.unread_count);
    }
  } else {
    if (msg.thread_id) {
      unreadState.clearThread(sUrl, msg.thread_id);
    } else {
      unreadState.clearChannel(sUrl, key);
    }
  }
}

export function handleUnreadsAck(msg: UnreadsAck, sUrl: string): void {
  const key = msg.thread_id || msg.channel;
  if (!key) return;
  
  // Clear unreads for this channel/thread
  if (msg.thread_id) {
    unreadState.clearThread(sUrl, msg.thread_id);
  } else {
    unreadState.clearChannel(sUrl, key);
  }
}

export function handleUnreadsUpdate(msg: UnreadsUpdate, sUrl: string): void {
  const key = msg.thread_id || msg.channel;
  if (!key) return;
  
  // This is broadcast when another session marks something as read
  // Clear unreads for this channel/thread
  if (msg.thread_id) {
    unreadState.clearThread(sUrl, msg.thread_id);
  } else {
    unreadState.clearChannel(sUrl, key);
  }
}
