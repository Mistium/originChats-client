import type { MessagesPinned } from "@/msgTypes";
import { pinnedMessages, pinnedLoading } from "../../ui-signals";

export function handleMessagesPinned(msg: MessagesPinned): void {
  pinnedMessages.value = msg.messages || [];
  pinnedLoading.value = false;
}
