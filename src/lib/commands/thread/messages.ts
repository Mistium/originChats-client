import type { ThreadMessages } from "@/msgTypes";
import {
  messagesByServer,
  loadedChannelsByServer,
  setThreadMessagesForServer,
} from "../../../state";
import { setMessages } from "../../message-utils";

export function handleThreadMessages(msg: ThreadMessages, sUrl: string): void {
  if (msg.thread_id && msg.messages) {
    setThreadMessagesForServer(sUrl, msg.thread_id, msg.messages);
    setMessages(sUrl, msg.thread_id, msg.messages);
    if (!loadedChannelsByServer[sUrl]) {
      loadedChannelsByServer[sUrl] = new Set();
    }
    loadedChannelsByServer[sUrl].add(msg.thread_id);
  }
}
