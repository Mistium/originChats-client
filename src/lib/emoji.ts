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

const dataUriCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<void>>();

function ensureCached(hexcode: string): void {
  if (dataUriCache.has(hexcode) || inflightRequests.has(hexcode)) return;

  const promise = fetch(`${TWEMOJI_CDN_BASE}/${hexcode}.svg`)
    .then((r) => r.text())
    .then((svg) => {
      const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      dataUriCache.set(hexcode, dataUri);
      inflightRequests.delete(hexcode);
    })
    .catch(() => {
      inflightRequests.delete(hexcode);
    });

  inflightRequests.set(hexcode, promise);
}

let pendingParse: {
  container: HTMLElement;
  timeout: ReturnType<typeof setTimeout> | null;
} | null = null;

function flushPendingParse() {
  if (pendingParse) {
    const { container } = pendingParse;
    pendingParse = null;
    twemoji.parse(container, {
      className: "emoji",
      folder: "svg",
      ext: ".svg",
      callback: (icon: string) => {
        ensureCached(icon);
        return dataUriCache.get(icon) || `${TWEMOJI_CDN_BASE}/${icon}.svg`;
      },
    });
  }
}

export function parseEmojisInContainer(container: HTMLElement): void {
  if (useSystemEmojis.value) return;

  if (pendingParse && pendingParse.container === container) {
    return;
  }

  if (pendingParse) {
    if (pendingParse.timeout) {
      clearTimeout(pendingParse.timeout);
    }
    pendingParse.container = container;
  } else {
    pendingParse = { container, timeout: null };
  }

  pendingParse.timeout = setTimeout(() => {
    flushPendingParse();
  }, 16);
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

  let hexcode: string;
  if (isChar) {
    hexcode = twemoji.convert.toCodePoint(value);
    if (!hexcode.includes("200d")) {
      hexcode = hexcode.replace(/-?fe0f/gi, "");
    }
  } else {
    hexcode = value.toLowerCase();
  }

  return `${TWEMOJI_CDN_BASE}/${hexcode}.svg`;
}
