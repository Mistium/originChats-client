import { store } from "@/state";

export default function unreads_ack(data: { channel_id: string; success?: boolean }) {
  const { channel_id, success = true } = data;
  
  if (success) {
    // Server acknowledged the read, update local state
    store.getState().unread.setChannelUnread(channel_id, 0);
    console.log(`[v0] Acknowledged unreads for channel ${channel_id}`);
  } else {
    console.warn(`[v0] Failed to acknowledge unreads for channel ${channel_id}`);
  }
}
