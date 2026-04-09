import { store } from "@/state";

export default function unreads_count(data: { total: number }) {
  const { total } = data;
  
  // This command provides the total unread count across all channels
  // We can use this for notifications or badges
  console.log("[v0] Total unread count:", total);
  
  // Store could maintain a total count if needed
  // For now, we calculate it from individual channel counts
}
