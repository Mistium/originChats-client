import type { MessageGet } from "@/msgTypes";
import { messageState, getMessageKey } from "../../../state";

const pendingReplyFetchesByServer: Record<string, Set<string>> = {};

export function handleMessageGet(msg: MessageGet, sUrl: string): void {
  const { channel, message } = msg;
  if (!channel || !message) return;
  pendingReplyFetchesByServer[sUrl]?.delete(message.id!);
  const messageKey = getMessageKey(msg);
  messageState.insert(sUrl, messageKey, message);
}
