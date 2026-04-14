import { useState, useEffect } from "preact/hooks";
import { proxyImageUrl } from "./utils";
import styles from "./link-preview.module.css";

interface LinkPreviewEmbedProps {
  originalUrl: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

const LARGE_IMAGE_THRESHOLD = 200;

export function LinkPreviewEmbed({
  originalUrl,
  title,
  description,
  image,
  siteName,
  favicon,
}: LinkPreviewEmbedProps) {
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!image) return;

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      setImageSize(null);
    };
    img.src = proxyImageUrl(image);
  }, [image]);

  const truncatedDescription =
    description && description.length > 200 ? description.slice(0, 197) + "..." : description;

  const displaySiteName = siteName
    ? siteName
    : (() => {
        try {
          const url = new URL(originalUrl);
          return url.hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      })();

  const isLargeImage =
    imageSize &&
    (imageSize.width > LARGE_IMAGE_THRESHOLD || imageSize.height > LARGE_IMAGE_THRESHOLD);

  const contentClassName = isLargeImage
    ? `${styles.content} ${styles["content--largeImage"]}`
    : styles.content;

  const imageWrapperClassName = isLargeImage
    ? `${styles.imageWrapper} ${styles["imageWrapper--large"]}`
    : styles.imageWrapper;

  const imageClassName = isLargeImage ? `${styles.image} ${styles["image--large"]}` : styles.image;

  return (
    <a href={originalUrl} target="_blank" rel="noopener noreferrer" className={styles.embed}>
      <div className={contentClassName}>
        <div className={styles.text}>
          <div className={styles.header}>
            {favicon && (
              <img src={proxyImageUrl(favicon)} alt="" className={styles.favicon} loading="lazy" />
            )}
            {displaySiteName && <span className={styles.site}>{displaySiteName}</span>}
          </div>
          <h3 className={styles.title}>{title}</h3>
          {truncatedDescription && <p className={styles.description}>{truncatedDescription}</p>}
        </div>
        {image && !isLargeImage && (
          <div className={imageWrapperClassName}>
            <img src={proxyImageUrl(image)} alt="" className={imageClassName} loading="lazy" />
          </div>
        )}
      </div>
      {image && isLargeImage && (
        <div className={imageWrapperClassName}>
          <img src={proxyImageUrl(image)} alt="" className={imageClassName} loading="lazy" />
        </div>
      )}
    </a>
  );
}
