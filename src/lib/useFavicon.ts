import { useEffect } from "preact/hooks";
import { unreadPings, unreadByChannel } from "../state";

const BASE_FAVICON = "/dms.png";
const FAVICON_SIZE = 32;

/**
 * Computes the sum of all values in a Record<string, number>.
 */
function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((acc, v) => acc + v, 0);
}

/**
 * Draws a red badge with a count (or a dot when count === 0 but hasUnreads)
 * onto a 32x32 canvas over the base favicon image.
 */
function drawFavicon(
  img: HTMLImageElement,
  pingCount: number,
  hasUnreads: boolean,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = FAVICON_SIZE;
  canvas.height = FAVICON_SIZE;
  const ctx = canvas.getContext("2d")!;

  ctx.save();
  ctx.beginPath();
  ctx.arc(FAVICON_SIZE / 2, FAVICON_SIZE / 2, FAVICON_SIZE / 2, 0, 2 * Math.PI);
  ctx.clip();
  ctx.drawImage(img, 0, 0, FAVICON_SIZE, FAVICON_SIZE);
  ctx.restore();

  if (pingCount > 0 || hasUnreads) {
    const badgeX = FAVICON_SIZE * 0.8;
    const badgeY = FAVICON_SIZE * 0.8;
    const badgeR = FAVICON_SIZE * 0.2;

    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR + 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR, 0, 2 * Math.PI);
    ctx.fillStyle = pingCount > 0 ? "#f04747" : "#ffffff";
    ctx.fill();

    if (pingCount > 0) {
      const label = pingCount > 99 ? "99+" : String(pingCount);
      const fontSize = label.length > 2 ? badgeR * 0.9 : badgeR * 1.1;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, badgeX, badgeY);
    }
  }

  return canvas.toDataURL("image/png");
}

let cachedImg: HTMLImageElement | null = null;

function loadBaseImage(): Promise<HTMLImageElement> {
  if (cachedImg) return Promise.resolve(cachedImg);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = BASE_FAVICON;
    img.onload = () => {
      cachedImg = img;
      resolve(img);
    };
    img.onerror = reject;
  });
}

function setFaviconHref(href: string) {
  let link = document.getElementById("favicon") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = "favicon";
    link.rel = "icon";
    link.type = "image/png";
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Watches unreadPings and unreadByChannel signals and:
 * - Draws a red badge with the total ping count on the favicon
 * - Shows a grey dot for unreads-only (no pings)
 * - Updates document.title with "(N) originChats" when there are pings
 */
export function useFavicon() {
  useEffect(() => {
    let destroyed = false;
    let baseImg: HTMLImageElement | null = null;

    loadBaseImage().then((img) => {
      baseImg = img;
      update();
    });

    function update() {
      if (destroyed || !baseImg) return;

      const pings = unreadPings.value;
      const unreads = unreadByChannel.value;
      const totalPings = sumValues(pings);
      const totalUnreads = sumValues(unreads);

      // Update title
      if (totalPings > 0) {
        document.title = `(${totalPings}) originChats`;
      } else {
        document.title = "originChats";
      }

      // Update favicon
      const dataUrl = drawFavicon(baseImg!, totalPings, totalUnreads > 0);
      setFaviconHref(dataUrl);
    }

    // Subscribe to both signals
    const unsubPings = unreadPings.subscribe(() => update());
    const unsubUnreads = unreadByChannel.subscribe(() => update());

    return () => {
      destroyed = true;
      unsubPings();
      unsubUnreads();
      // Restore plain favicon and title on unmount
      setFaviconHref(BASE_FAVICON);
      document.title = "originChats";
    };
  }, []);
}
