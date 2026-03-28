import type { MessageEdit } from "@/msgTypes";
import { getMessageKey, updateMessage } from "../../message-utils";

export function handleMessageEdit(msg: MessageEdit, sUrl: string): void {
  const messageKey = getMessageKey(msg);
  updateMessage(sUrl, messageKey, msg.id, {
    content: msg.content,
    edited: true,
  });
}
