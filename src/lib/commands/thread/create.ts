import type { ThreadCreate } from "@/msgTypes";
import { addThreadToChannel } from "../../../state";
import { renderChannelsSignal } from "../../ui-signals";

export function handleThreadCreate(msg: ThreadCreate, sUrl: string): void {
  if (msg.thread && msg.channel) {
    addThreadToChannel(sUrl, msg.channel, msg.thread);
    renderChannelsSignal.value++;
  }
}
