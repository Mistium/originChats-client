import type { ThreadGet } from "@/msgTypes";
import { currentThread } from "../../../state";

export function handleThreadGet(msg: ThreadGet): void {
  if (msg.thread) {
    currentThread.value = msg.thread;
  }
}
