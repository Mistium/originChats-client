import type { MessageDelete } from "@/msgTypes";
import { getMessageKey, removeMessage } from "../../message-utils";

export function handleMessageDelete(msg: MessageDelete, sUrl: string): void {
  const messageKey = getMessageKey(msg);
  removeMessage(sUrl, messageKey, msg.id);
}
