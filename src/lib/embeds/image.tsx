import { useState, useEffect, useRef } from "preact/hooks";
import { proxyImageUrl } from "./utils";
import {
  getCachedImage,
  getCachedImageSync,
  getCachedImageSize,
  saveImageSize,
  scheduleCleanup,
} from "../image-cache";

export function ImageEmbed({ url }: { url: string }) {
  const initialCached = getCachedImageSync(url);
  const initialSize = getCachedImageSize(url);
  const [isValid, setIsValid] = useState<boolean | null>(() => {
    if (initialCached) return true;
    if (initialSize) return true;
    return null;
  });
  const [cachedSrc, setCachedSrc] = useState<string | null>(() => initialCached);
  const [cachedSize, setCachedSize] = useState<{
    width: number;
    height: number;
  } | null>(() => initialSize);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (initialCached || initialSize) return;

    let cancelled = false;

    const checkAndCacheImage = async () => {
      scheduleCleanup();

      try {
        const urlObj = new URL(url);
        if (urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1") {
          setIsValid(false);
          return;
        }
      } catch {}

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
          method: "HEAD",
          mode: "cors",
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (cancelled) return;

        if (res.ok) {
          const ct = res.headers.get("Content-Type") || "";
          const isImage = ct.startsWith("image/");
          setIsValid(isImage);

          if (isImage && !getCachedImageSync(url)) {
            const cached = await getCachedImage(url);
            if (!cancelled && cached) {
              setCachedSrc(cached);
            }
          }
        } else {
          setIsValid(false);
        }
      } catch (err) {
        if (!cancelled) setIsValid(false);
      }
    };

    checkAndCacheImage();
    return () => {
      cancelled = true;
    };
  }, [url, initialCached, initialSize]);

  if (isValid === null) {
    const style = cachedSize
      ? `width: ${Math.min(cachedSize.width, 400)}px; aspect-ratio: ${cachedSize.width} / ${cachedSize.height};`
      : "";
    return <div className="embed-container image-embed skeleton" style={style} />;
  }
  if (!isValid)
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    );

  const handleImageLoad = () => {
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      if (naturalWidth > 0 && naturalHeight > 0) {
        saveImageSize(url, naturalWidth, naturalHeight);
        setCachedSize({ width: naturalWidth, height: naturalHeight });
      }
    }
  };

  const imgStyle = cachedSize
    ? `width: ${Math.min(cachedSize.width, 400)}px; aspect-ratio: ${cachedSize.width} / ${cachedSize.height}; cursor: pointer;`
    : "cursor: pointer";

  return (
    <div className="embed-container image-embed">
      <div className="chat-image-wrapper">
        <img
          ref={imgRef}
          src={cachedSrc || proxyImageUrl(url)}
          alt="image"
          className="message-image"
          data-image-url={url}
          loading="lazy"
          style={imgStyle}
          onLoad={handleImageLoad}
        />
      </div>
    </div>
  );
}
