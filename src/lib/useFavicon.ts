import { useEffect } from "preact/hooks";
import { unreadState } from "../state";

const BASE_FAVICON = "/dms.png";
const FAVICON_SIZE = 32;

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

      const totalPings = unreadState.getTotalPings();
      const totalUnreads = unreadState.getTotalUnreads();

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
    const unsubPings = unreadState.pings.subscribe(() => update());
    const unsubUnreads = unreadState.unreads.subscribe(() => update());

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
