import { useMemo } from "preact/hooks";
import { parseEmojisInText } from "../../lib/emoji/emoji";
import { useSystemEmojis } from "../../state";

interface TwemojiTextProps {
  children: string;
  className?: string;
}

export function TwemojiText({ children, className }: TwemojiTextProps) {
  const html = useMemo(() => {
    return parseEmojisInText(children);
  }, [children]);

  if (useSystemEmojis.value) {
    return <span className={className}>{children}</span>;
  }

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
