import type { MessageEdit } from "@/msgTypes";
import { messageState, getMessageKey } from "../../../state";

export function handleMessageEdit(msg: MessageEdit, sUrl: string): void {
  const messageKey = getMessageKey(msg);
  messageState.update(sUrl, messageKey, msg.id, { content: msg.content, edited: true });
}
