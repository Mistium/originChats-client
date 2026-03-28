import type { MessageReactAdd, MessageReactRemove } from "@/msgTypes";
import { messagesByServer } from "../../../state";
import { renderMessagesSignal } from "../../ui-signals";
import { getMessageKey } from "../../message-utils";

export function handleMessageReact(
  msg: MessageReactAdd | MessageReactRemove,
  sUrl: string,
): void {
  const messageKey = getMessageKey(msg);
  if (!messagesByServer.value[sUrl]?.[messageKey]) return;
  const reactMsg = messagesByServer.value[sUrl][messageKey].find(
    (m) => m.id === msg.id,
  );
  if (reactMsg) {
    const reactUser: string = typeof msg.from === "string" ? msg.from : "";
    if (!reactMsg.reactions) reactMsg.reactions = {};
    if (msg.cmd === "message_react_add") {
      if (!reactMsg.reactions[msg.emoji]) reactMsg.reactions[msg.emoji] = [];
      if (!reactMsg.reactions[msg.emoji].includes(reactUser)) {
        reactMsg.reactions[msg.emoji].push(reactUser);
      }
    } else {
      if (reactMsg.reactions[msg.emoji]) {
        reactMsg.reactions[msg.emoji] = reactMsg.reactions[msg.emoji].filter(
          (u: string) => u !== reactUser,
        );
        if (reactMsg.reactions[msg.emoji].length === 0) {
          delete reactMsg.reactions[msg.emoji];
        }
      }
    }
  }
  renderMessagesSignal.value++;
}
