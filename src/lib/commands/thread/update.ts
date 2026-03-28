import type { ThreadUpdate as ThreadUpdateMsg } from "@/msgTypes";
import { currentThread, updateThreadInChannel } from "../../../state";
import { renderChannelsSignal } from "../../ui-signals";

export function handleThreadUpdate(msg: ThreadUpdateMsg, sUrl: string): void {
  if (msg.thread && msg.channel) {
    const { thread, channel } = msg;
    updateThreadInChannel(sUrl, channel, thread.id, thread);
    if (currentThread.value?.id === thread.id) {
      currentThread.value = { ...currentThread.value, ...thread };
    }
    renderChannelsSignal.value++;
  }
}
