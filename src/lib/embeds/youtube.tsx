import { useState, useEffect } from "preact/hooks";
import { proxyImageUrl } from "./utils";

interface YouTubeEmbedProps {
  videoId: string;
  originalUrl: string;
}

export function YouTubeEmbed({ videoId, originalUrl }: YouTubeEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(originalUrl)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.title) setTitle(data.title);
      })
      .catch(() => {});
  }, [originalUrl]);

  return (
    <div className="embed-container youtube-embed">
      {!isPlaying ? (
        <div
          className="youtube-thumbnail"
          style={{
            backgroundImage: `url(${proxyImageUrl(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`)})`,
          }}
        >
          <div className="embed-play-button" onClick={() => setIsPlaying(true)}>
            <svg viewBox="0 0 68 48" width="68" height="48">
              <path
                class="play-bg"
                d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19 C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"
                fill="#f00"
              />
              <path d="M 45,24 27,14 27,34" fill="#fff" />
            </svg>
          </div>
        </div>
      ) : (
        <div className="youtube-iframe">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {title && <div className="youtube-title">{title}</div>}
    </div>
  );
}
