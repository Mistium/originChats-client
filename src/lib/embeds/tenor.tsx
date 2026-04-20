import { useState, useEffect, useRef } from "preact/hooks";
import { proxyImageUrl } from "./utils";
import {
  getCachedImage,
  getCachedImageSync,
  getCachedImageSize,
  saveImageSize,
  scheduleCleanup,
} from "../media/image-cache";

interface TenorEmbedProps {
  tenorId: string;
  originalUrl: string;
}

export function TenorEmbed({ tenorId }: TenorEmbedProps) {
  const sizeKey = `tenor:${tenorId}`;
  const initialSize = getCachedImageSize(sizeKey);
  const [gifUrl, setGifUrl] = useState("");
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [cachedSize, setCachedSize] = useState<{
    width: number;
    height: number;
  } | null>(() => initialSize);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;
    scheduleCleanup();

    fetch(`https://apps.mistium.com/tenor/get?id=${tenorId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Tenor API failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data?.[0]?.media?.[0]) throw new Error("Invalid Tenor response");
        const media = data[0].media[0];
        const url = media.mediumgif?.url || media.gif?.url || media.tinygif?.url;
        if (!url) throw new Error("No GIF URL found");
        setGifUrl(url);

        const syncCached = getCachedImageSync(url);
        const syncSize = getCachedImageSize(url);
        if (syncSize) {
          setCachedSize(syncSize);
        }
        if (syncCached) {
          setCachedSrc(syncCached);
        } else {
          getCachedImage(url).then((cached) => {
            if (!cancelled && cached) {
              setCachedSrc(cached);
            }
          });
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [tenorId]);

  if (error || !gifUrl) {
    const style = cachedSize
      ? `width: ${Math.min(cachedSize.width, 400)}px; aspect-ratio: ${cachedSize.width} / ${cachedSize.height};`
      : "width: 200px; height: 150px;";
    return <div className="embed-container tenor-embed skeleton" style={style} />;
  }

  const handleImageLoad = () => {
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      if (naturalWidth > 0 && naturalHeight > 0) {
        saveImageSize(sizeKey, naturalWidth, naturalHeight);
        setCachedSize({ width: naturalWidth, height: naturalHeight });
      }
    }
  };

  const imgStyle = cachedSize
    ? `width: ${Math.min(cachedSize.width, 400)}px; aspect-ratio: ${cachedSize.width} / ${cachedSize.height};`
    : "";

  return (
    <div className="embed-container tenor-embed">
      <div className="chat-image-wrapper">
        <img
          ref={imgRef}
          src={cachedSrc || proxyImageUrl(gifUrl)}
          alt="Tenor GIF"
          className="tenor-gif message-image"
          data-image-url={gifUrl}
          loading="lazy"
          style={imgStyle}
          onLoad={handleImageLoad}
        />
      </div>
    </div>
  );
}
