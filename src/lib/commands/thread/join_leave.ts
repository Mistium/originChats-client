import type { ThreadJoin, ThreadLeave } from "@/msgTypes";
import type { Thread } from "../../../types";
import { currentThread, updateThreadInChannel } from "../../../state";
import { renderChannelsSignal } from "../../ui-signals";

export function handleThreadJoin(msg: ThreadJoin, sUrl: string): void {
  if (msg.thread && msg.thread_id) {
    updateThreadInChannel(sUrl, msg.thread.parent_channel, msg.thread_id, {
      participants: msg.thread.participants,
    });
    if (currentThread.value?.id === msg.thread_id) {
      currentThread.value = {
        ...currentThread.value,
        participants: msg.thread.participants,
      } as Thread;
    }
    renderChannelsSignal.value++;
  }
}

export function handleThreadLeave(msg: ThreadLeave, sUrl: string): void {
  if (msg.thread && msg.thread_id) {
    updateThreadInChannel(sUrl, msg.thread.parent_channel, msg.thread_id, {
      participants: msg.thread.participants,
    });
    if (currentThread.value?.id === msg.thread_id) {
      currentThread.value = {
        ...currentThread.value,
        participants: msg.thread.participants,
      } as Thread;
    }
    renderChannelsSignal.value++;
  }
}
