import { store } from "@/state";

export default function unreads_get(data: { unreads: Record<string, number> }) {
  const { unreads } = data;
  
  // Update all channel unread counts from server
  store.getState().unread.setAllUnreads(unreads);
  
  console.log("[v0] Received unreads:", unreads);
}
