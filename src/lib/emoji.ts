/**
 * Centralised emoji rendering handler.
 *
 * All emoji display in the app should go through this module so that the
 * "Use system emojis" setting is honoured in one place.
 *
 * When system emojis are enabled:
 *   - `parseEmojisInContainer` is a no-op (raw Unicode is left in the DOM).
 *   - `emojiImgUrl` returns null so callers can render plain text instead.
 *
 * When system emojis are disabled (default):
 *   - `parseEmojisInContainer` delegates to twemoji.parse().
 *   - `emojiImgUrl` returns the CDN SVG URL for the given hexcode or Unicode char.
 */

import twemoji from "@twemoji/api";
import { useSystemEmojis } from "../state";

const TWEMOJI_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg";

/**
 * Walk a DOM container and replace Unicode emoji characters with <img> tags
 * pointing to the Twemoji CDN SVGs.
 *
 * When `useSystemEmojis` is true this is a no-op so the browser renders its
 * own glyph.
 */
export function parseEmojisInContainer(container: HTMLElement): void {
  if (useSystemEmojis.value) return;

  twemoji.parse(container, {
    className: "emoji",
    folder: "svg",
    ext: ".svg",
  });
}

/**
 * Return the Twemoji CDN SVG URL for an emoji identified by its hexcode
 * (e.g. "1f600") or a raw Unicode character (e.g. "😀").
 *
 * Returns `null` when system emojis are enabled, signalling that the caller
 * should render the raw character rather than an <img>.
 *
 * @param value  Either a lowercase hex codepoint string or a raw emoji character.
 * @param isChar When `true`, `value` is treated as a raw Unicode character and
 *               `twemoji.convert.toCodePoint()` is used to derive the hexcode.
 */
export function emojiImgUrl(value: string, isChar = false): string | null {
  if (useSystemEmojis.value) return null;

  const hexcode = isChar
    ? twemoji.convert.toCodePoint(value).toLowerCase()
    : value.toLowerCase();

  return `${TWEMOJI_CDN_BASE}/${hexcode}.svg`;
}
