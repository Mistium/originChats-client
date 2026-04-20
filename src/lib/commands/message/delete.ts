import type { MessageDelete } from "@/msgTypes";
import { messageState, getMessageKey } from "../../../state";

export function handleMessageDelete(msg: MessageDelete, sUrl: string): void {
  const messageKey = getMessageKey(msg);
  messageState.delete(sUrl, messageKey, msg.id);
}
