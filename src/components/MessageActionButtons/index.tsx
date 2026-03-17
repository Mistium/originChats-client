import { Icon } from "../Icon";
import type { Message } from "../../types";
import styles from "./MessageActionButtons.module.css";

const QUICK_REACTIONS = ["👍", "👎", "😄", "❤️"];

interface MessageActionButtonsProps {
  message: Message;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onOpenEmojiPicker: () => void;
  onContextMenu: (e: MouseEvent) => void;
  canReact: boolean;
  canReply: boolean;
  isOwn: boolean;
}

export function MessageActionButtons({
  message,
  onReply,
  onReact,
  onOpenEmojiPicker,
  onContextMenu,
  canReact,
  canReply,
  isOwn,
}: MessageActionButtonsProps) {
  const handleMoreClick = (e: MouseEvent) => {
    e.stopPropagation();
    onContextMenu(e);
  };

  return (
    <div className={`messageActionButtons ${styles.messageActionButtons}`}>
      {canReact &&
        QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            className={`${styles.actionBtn} ${styles.quickReaction}`}
            onClick={(e) => {
              e.stopPropagation();
              onReact(emoji);
            }}
          >
            {emoji}
          </button>
        ))}
      {canReact && (
        <button
          className={styles.actionBtn}
          title="React"
          onClick={(e) => {
            e.stopPropagation();
            onOpenEmojiPicker();
          }}
        >
          <Icon name="SmilePlus" size={16} />
        </button>
      )}
      {canReply && (
        <button
          className={styles.actionBtn}
          title="Reply"
          onClick={(e) => {
            e.stopPropagation();
            onReply();
          }}
        >
          <Icon name="MessageCircle" size={16} />
        </button>
      )}
      <button
        className={styles.actionBtn}
        title="More"
        onClick={handleMoreClick}
      >
        <Icon name="MoreHorizontal" size={16} />
      </button>
    </div>
  );
}
