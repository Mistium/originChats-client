import { memo } from "preact/compat";
import { emojiImgUrl, isCustomEmoji, getCustomEmojiUrl } from "../../lib/emoji";
import { useSystemEmojis } from "../../state";

export interface EmojiDisplayProps {
  emoji: string;
  className?: string;
  systemClassName?: string;
  alt?: string;
  style?: Record<string, string | number>;
}

function EmojiDisplayBase({
  emoji,
  className = "emoji",
  systemClassName,
  alt,
  style,
}: EmojiDisplayProps) {
  const useSystem = useSystemEmojis.value;

  if (isCustomEmoji(emoji)) {
    const url = getCustomEmojiUrl(emoji);
    if (url) {
      return (
        <img
          class={className}
          src={url}
          alt={alt || "custom emoji"}
          style={style}
          draggable={false}
        />
      );
    }
  }

  if (!useSystem) {
    const url = emojiImgUrl(emoji, true);
    if (url) {
      return <img class={className} src={url} alt={alt || emoji} style={style} draggable={false} />;
    }
  }

  return (
    <span class={systemClassName || className} style={style}>
      {emoji}
    </span>
  );
}

export const EmojiDisplay = memo(EmojiDisplayBase);

export interface ReactionEmojiProps {
  emoji: string;
  size?: number;
}

function ReactionEmojiBase({ emoji, size = 16 }: ReactionEmojiProps) {
  return (
    <EmojiDisplay
      emoji={emoji}
      className="reaction-emoji"
      systemClassName="reaction-emoji reaction-emoji-system"
      style={{ width: size, height: size }}
    />
  );
}

export const ReactionEmoji = memo(ReactionEmojiBase);

export interface ModalEmojiProps {
  emoji: string;
}

function ModalEmojiBase({ emoji }: ModalEmojiProps) {
  return (
    <EmojiDisplay
      emoji={emoji}
      className="reaction-modal-emoji"
      systemClassName="reaction-modal-emoji reaction-modal-emoji-system"
    />
  );
}

export const ModalEmoji = memo(ModalEmojiBase);
