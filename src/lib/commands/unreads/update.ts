import { store } from "@/state";

export default function unreads_update(data: { channel_id: string; count: number }) {
  const { channel_id, count } = data;
  
  // Update unread count for a specific channel
  store.getState().unread.setChannelUnread(channel_id, count);
  
  console.log(`[v0] Updated unreads for channel ${channel_id}:`, count);
}
