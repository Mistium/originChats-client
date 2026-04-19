import type { Message } from "../../types";

export interface MessageListProps {
  messages?: Message[];
  channelName?: string;
  mode?: "main" | "panel" | "compact";
  loading?: boolean;
  emptyIcon?: string;
  emptyText?: string;
  onMessageClick?: (msg: Message) => void;
  onMessageContextMenu?: (e: MouseEvent, msg: Message) => void;
  showChannelContext?: boolean;
  showReplyPreview?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

export interface MessageGroup {
  head: Message;
  following: Message[];
}

export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;
  for (const msg of messages) {
    const shouldStartNewGroup =
      !currentGroup ||
      msg.user !== currentGroup.head.user ||
      msg.timestamp - currentGroup.head.timestamp >= 300 ||
      !!msg.reply_to;
    if (shouldStartNewGroup) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = { head: msg, following: [] };
    } else if (currentGroup) {
      currentGroup.following.push(msg);
    }
  }
  if (currentGroup) groups.push(currentGroup);
  return groups;
}
