import { memo } from "preact/compat";
import { useMemo } from "preact/hooks";
import { currentUser } from "../../state";
import { avatarUrl } from "../../utils";
import { MessageContent } from "../MessageContent";
import type { Message } from "../../types";
import { openUserPopout } from "../UserPopout";
import { useDisplayName, useUserColor } from "../../lib/useDisplayName";
import styles from "./MessageGroupRow.module.css";

export interface MessageGroup {
  head: Message;
  following: Message[];
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface MessageGroupRowProps {
  group: MessageGroup;
  onClick?: () => void;
  onContextMenu?: (e: any) => void;
}

function MessageGroupRowInner({
  group,
  onClick,
  onContextMenu,
}: MessageGroupRowProps) {
  const headUser = group.head.user;
  const displayName = useDisplayName(headUser);
  const color = useUserColor(headUser);
  const currentUsername = currentUser.value?.username;

  const followingMessages = useMemo(
    () =>
      group.following.map((msg) => (
        <div key={msg.id} className={styles.messageSingle}>
          <span className={styles.timestamp}>
            {formatRelativeTime(msg.timestamp)}
          </span>
          <MessageContent
            content={msg.content}
            currentUsername={currentUsername}
            authorUsername={msg.user}
            pings={msg.pings}
          />
        </div>
      )),
    [group.following, currentUsername],
  );

  return (
    <div
      className={styles.messageGroup}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <img
        src={avatarUrl(headUser)}
        className={`${styles.avatar} ${styles.clickable}`}
        alt={headUser}
        onClick={(e: any) => openUserPopout(e, headUser)}
      />
      <div className={styles.messageGroupContent}>
        <div className={styles.messageHeader}>
          <span
            className={`${styles.username} ${styles.clickable}`}
            style={{ color }}
            onClick={(e: any) => openUserPopout(e, headUser)}
          >
            {displayName}
          </span>
          <span className={styles.timestamp}>
            {formatRelativeTime(group.head.timestamp)}
          </span>
        </div>
        <div className={styles.messageBody}>
          <MessageContent
            content={group.head.content}
            currentUsername={currentUsername}
            authorUsername={headUser}
            pings={group.head.pings}
          />
        </div>
        {group.following.length > 0 && (
          <div className={styles.messageGroupFollowing}>
            {followingMessages}
          </div>
        )}
      </div>
    </div>
  );
}

export const MessageGroupRow = memo(MessageGroupRowInner);
