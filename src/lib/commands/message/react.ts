import type { MessageReactAdd, MessageReactRemove } from "@/msgTypes";
import { messageState, getMessageKey } from "../../../state";

export function handleMessageReact(msg: MessageReactAdd | MessageReactRemove, sUrl: string): void {
  const messageKey = getMessageKey(msg);
  const channelMessages = messageState.get(sUrl, messageKey);
  if (!channelMessages) return;
  const msgIndex = channelMessages.findIndex((m) => m.id === msg.id);
  if (msgIndex === -1) return;

  const reactUser: string = typeof msg.from === "string" ? msg.from : "";
  const reactMsg = channelMessages[msgIndex];
  const updatedReactions = reactMsg.reactions ? { ...reactMsg.reactions } : {};

  if (msg.cmd === "message_react_add") {
    if (!updatedReactions[msg.emoji]) {
      updatedReactions[msg.emoji] = [];
    }
    if (!updatedReactions[msg.emoji].includes(reactUser)) {
      updatedReactions[msg.emoji] = [...updatedReactions[msg.emoji], reactUser];
    }
  } else {
    if (updatedReactions[msg.emoji]) {
      updatedReactions[msg.emoji] = updatedReactions[msg.emoji].filter(
        (u: string) => u !== reactUser
      );
      if (updatedReactions[msg.emoji].length === 0) {
        delete updatedReactions[msg.emoji];
      }
    }
  }

  messageState.update(sUrl, messageKey, msg.id, { reactions: updatedReactions });
}
