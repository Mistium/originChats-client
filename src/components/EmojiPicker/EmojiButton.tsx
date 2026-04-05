import { memo } from "preact/compat";
import { useSystemEmojis } from "../../state";
import { getEmojiImgOrDataUri } from "../../lib/emoji";

interface EmojiButtonProps {
  emoji: string;
  label: string;
  hexcode: string;
  onClick: () => void;
}

function EmojiButtonImpl({ emoji, label, hexcode, onClick }: EmojiButtonProps) {
  return (
    <button
      className="emoji-button"
      onClick={onClick}
      title={label}
      type="button"
    >
      <EmojiImage emoji={emoji} hexcode={hexcode} />
    </button>
  );
}

export const EmojiButton = memo(EmojiButtonImpl);

interface CustomEmojiButtonProps {
  id: string;
  name: string;
  fileName: string;
  serverUrl: string;
  serverName: string;
  onClick: () => void;
}

function CustomEmojiButtonImpl({
  name,
  fileName,
  serverUrl,
  onClick,
}: CustomEmojiButtonProps) {
  const baseUrl = serverUrl.startsWith("http")
    ? serverUrl
    : `https://${serverUrl}`;
  const url = `${baseUrl}/emojis/${fileName}`;

  return (
    <button
      className="emoji-button"
      onClick={onClick}
      title={`:${name}:`}
      type="button"
    >
      <img
        src={url}
        alt={name}
        className="emoji-custom-img"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </button>
  );
}

export const CustomEmojiButton = memo(CustomEmojiButtonImpl);

interface EmojiImageProps {
  emoji: string;
  hexcode: string;
}

function EmojiImageImpl({ emoji, hexcode }: EmojiImageProps) {
  const useSystem = useSystemEmojis.value;

  if (useSystem) {
    return <span className="emoji-picker-emoji">{emoji}</span>;
  }

  const url = getEmojiImgOrDataUri(emoji);
  if (!url) {
    return <span className="emoji-picker-emoji">{emoji}</span>;
  }

  return (
    <img
      src={url}
      alt={emoji}
      className="emoji-picker-emoji-img"
      draggable={false}
      loading="lazy"
      decoding="async"
    />
  );
}

export const EmojiImage = memo(EmojiImageImpl);
