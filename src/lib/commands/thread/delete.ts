import type { ThreadDelete } from "@/msgTypes";
import { currentThread, removeThreadFromChannel } from "../../../state";
import { renderChannelsSignal } from "../../ui-signals";

export function handleThreadDelete(msg: ThreadDelete, sUrl: string): void {
  if (msg.thread_id && msg.channel) {
    removeThreadFromChannel(sUrl, msg.channel, msg.thread_id);
    if (currentThread.value?.id === msg.thread_id) {
      currentThread.value = null;
    }
    renderChannelsSignal.value++;
  }
}
