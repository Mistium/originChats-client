import { useState, useEffect, useRef, useMemo } from "preact/hooks";
import type { TargetedInputEvent } from "preact";
import { recentEmojis } from "../state";
import { Icon } from "./Icon";
import { VirtualGrid } from "./VirtualGrid";
import { favGifs as dbFavGifs } from "../lib/db";
import { emojiImgUrl } from "../lib/emoji";

interface EmojiEntry {
  label: string;
  hexcode: string;
  emoji: string;
  tags?: string[];
  order?: number;
  group?: number;
}

interface GifResult {
  id: string;
  media: {
    tinygif?: { url: string };
    gif?: { url: string };
    nanogif?: { url: string };
    preview?: string;
  }[];
  title: string;
  itemurl: string;
}

interface SavedGif {
  url: string;
  savedAt: number;
}

export interface UnifiedPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gifUrl: string) => void;
  anchorRef?: { current: HTMLElement | null };
  initialTab?: "emoji" | "gif";
}

function hexcodeToEmoji(hexcode: string): string {
  return String.fromCodePoint(
    ...hexcode.split("-").map((h) => parseInt(h, 16)),
  );
}

function TwemojiImg({
  hexcode,
  alt,
  emoji,
}: {
  hexcode: string;
  alt: string;
  emoji?: string;
}) {
  const url = emojiImgUrl(hexcode);
  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        className="twemoji-picker-img"
        draggable={false}
      />
    );
  }
  const char = emoji ?? hexcodeToEmoji(hexcode);
  return (
    <span className="twemoji-picker-img twemoji-picker-system">{char}</span>
  );
}

const EMOJI_GROUP_NAMES: Record<number, string> = {
  0: "Smileys & Emotion",
  1: "People & Body",
  3: "Animals & Nature",
  4: "Food & Drink",
  5: "Travel & Places",
  6: "Activities",
  7: "Objects",
  8: "Symbols",
  9: "Flags",
};

const EMOJI_GROUP_ICONS: Record<number, string> = {
  0: "1f600",
  1: "1f44b",
  3: "1f435",
  4: "1f347",
  5: "1f30d",
  6: "1f383",
  7: "1f4bc",
  8: "1f3e7",
  9: "1f3c1",
};

const QUICK_REACTIONS = [
  "😭",
  "😔",
  "💀",
  "👍",
  "👎",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🔥",
];

const DISPLAY_GROUPS = [0, 1, 3, 4, 5, 6, 7, 8, 9];

let emojiDataCache: EmojiEntry[] | null = null;
let emojiDataPromise: Promise<EmojiEntry[]> | null = null;

function fetchEmojiData(): Promise<EmojiEntry[]> {
  if (emojiDataCache) return Promise.resolve(emojiDataCache);
  if (emojiDataPromise) return emojiDataPromise;
  emojiDataPromise = fetch("/shortcodes.json")
    .then((res) => res.json())
    .then((data: EmojiEntry[]) => {
      emojiDataCache = data.filter(
        (e) => e.group !== undefined && e.group !== -1 && e.group !== 2,
      );
      emojiDataCache.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return emojiDataCache;
    });
  return emojiDataPromise;
}

function useEmojiData() {
  const [emojis, setEmojis] = useState<EmojiEntry[]>(emojiDataCache ?? []);

  useEffect(() => {
    if (emojiDataCache) {
      setEmojis(emojiDataCache);
      return;
    }
    fetchEmojiData().then(setEmojis);
  }, []);

  return emojis;
}

export function UnifiedPicker({
  isOpen,
  onClose,
  onEmojiSelect,
  onGifSelect,
  anchorRef,
  initialTab = "emoji",
}: UnifiedPickerProps) {
  const [activeTab, setActiveTab] = useState<"emoji" | "gif">(initialTab);
  const [searchTerm, setSearchTerm] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      if (initialTab) setActiveTab(initialTab);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    positionPicker();

    const handleClickOutside = (e: Event) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        !anchorRef?.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleResize = () => positionPicker();

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, anchorRef, onClose]);

  const positionPicker = () => {
    if (!anchorRef?.current || !pickerRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const picker = pickerRef.current;
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      picker.style.left = "0";
      picker.style.right = "0";
      picker.style.bottom = "0";
      picker.style.top = "auto";
      picker.style.width = "100%";
      picker.style.maxHeight = "60vh";
    } else {
      const pickerRect = picker.getBoundingClientRect();
      let x = rect.right - pickerRect.width;
      let y = rect.top - pickerRect.height - 8;
      if (x < 10) x = 10;
      if (y < 10) y = rect.bottom + 8;
      picker.style.left = `${x}px`;
      picker.style.top = `${y}px`;
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={pickerRef} className="unified-picker">
      <div className="unified-picker-header">
        <div className="unified-picker-tabs">
          <button
            className={`unified-tab ${activeTab === "emoji" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("emoji");
              setSearchTerm("");
            }}
          >
            <Icon name="Smile" size={16} />
            Emoji
          </button>
          <button
            className={`unified-tab ${activeTab === "gif" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("gif");
              setSearchTerm("");
            }}
          >
            <Icon name="Image" size={16} />
            GIFs
          </button>
        </div>
        <button className="unified-picker-close" onClick={onClose}>
          <Icon name="X" size={16} />
        </button>
      </div>
      <div className="unified-picker-search">
        <Icon name="Search" size={14} />
        <input
          type="text"
          placeholder={
            activeTab === "emoji" ? "Search emoji..." : "Search Tenor GIFs..."
          }
          value={searchTerm}
          onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
          autoFocus
        />
      </div>
      {activeTab === "emoji" ? (
        <EmojiPanel
          searchTerm={searchTerm}
          onSelect={onEmojiSelect}
          onClose={onClose}
        />
      ) : (
        <GifPanel
          searchTerm={searchTerm}
          onSelect={onGifSelect}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function EmojiPanel({
  searchTerm,
  onSelect,
  onClose,
}: {
  searchTerm: string;
  onSelect: (e: string) => void;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const allEmojis = useEmojiData();

  const { groupedEmojis, allEmojisFlat, GROUP_OFFSETS } = useMemo(() => {
    const groups: Record<number, EmojiEntry[]> = {};
    const flat: EmojiEntry[] = [];
    const offsets: Record<number, number> = {};
    let flatIndex = 0;

    for (const groupId of DISPLAY_GROUPS) {
      offsets[groupId] = flatIndex;
      groups[groupId] = [];
      const groupEmojis = allEmojis.filter((e) => (e.group ?? -1) === groupId);
      for (const entry of groupEmojis) {
        groups[groupId].push(entry);
        flat.push(entry);
        flatIndex++;
      }
    }

    return {
      groupedEmojis: groups,
      allEmojisFlat: flat,
      GROUP_OFFSETS: offsets,
    };
  }, [allEmojis]);

  const addRecent = (emoji: string) => {
    const current = recentEmojis.value;
    const updated = [emoji, ...current.filter((e) => e !== emoji)].slice(0, 50);
    recentEmojis.value = updated;
    onSelect(emoji);
    onClose();
  };

  const findHexcode = (emoji: string): string | null => {
    const entry = allEmojis.find((e) => e.emoji === emoji);
    return entry?.hexcode ?? null;
  };

  if (searchTerm.trim()) {
    const query = searchTerm.toLowerCase();
    const filtered = allEmojis
      .filter(
        (e) =>
          e.label.toLowerCase().includes(query) ||
          e.emoji.includes(searchTerm) ||
          (e.tags && e.tags.some((t) => t.toLowerCase().includes(query))),
      )
      .slice(0, 200);
    return (
      <div className="unified-picker-body">
        {filtered.length === 0 ? (
          <div className="picker-empty">
            <Icon name="Search" size={32} />
            <p>No emoji found</p>
          </div>
        ) : (
          <div className="emoji-grid">
            {filtered.map((entry, i) => (
              <button
                key={`${entry.hexcode}-${i}`}
                className="emoji-button"
                onClick={() => addRecent(entry.emoji)}
                title={entry.label}
              >
                <TwemojiImg hexcode={entry.hexcode} alt={entry.emoji} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="unified-picker-body">
      <div className="emoji-category-nav">
        <button
          className={`emoji-cat-btn ${activeCategory === null ? "active" : ""}`}
          onClick={() => {
            setActiveCategory(null);
          }}
          title="All"
        >
          <TwemojiImg hexcode="1f552" alt="Recent" />
        </button>
        {DISPLAY_GROUPS.map((groupId) => (
          <button
            key={groupId}
            className={`emoji-cat-btn ${activeCategory === groupId ? "active" : ""}`}
            onClick={() => setActiveCategory(groupId)}
            title={EMOJI_GROUP_NAMES[groupId]}
          >
            <TwemojiImg
              hexcode={EMOJI_GROUP_ICONS[groupId]}
              alt={EMOJI_GROUP_NAMES[groupId]}
            />
          </button>
        ))}
      </div>
      <div className="emoji-grid-container" ref={gridContainerRef}>
        {!activeCategory ? (
          <>
            <div className="emoji-section-label">Recent</div>
            <div className="emoji-grid">
              {(recentEmojis.value.length > 0
                ? recentEmojis.value
                : QUICK_REACTIONS
              ).map((emoji, i) => {
                const hex = findHexcode(emoji);
                if (!hex) return null;
                return (
                  <button
                    key={`recent-${hex}-${i}`}
                    className="emoji-button"
                    onClick={() => addRecent(emoji)}
                    title={emoji}
                  >
                    <TwemojiImg hexcode={hex} alt={emoji} />
                  </button>
                );
              })}
            </div>
            <div className="emoji-section-label">All Emojis</div>
            <div
              className="emoji-grid-virtual-wrapper"
              style={{ height: "400px" }}
            >
              <VirtualGrid<EmojiEntry>
                items={allEmojisFlat}
                renderItem={(entry, i) => (
                  <button
                    key={`${entry.hexcode}-${i}`}
                    className="emoji-button"
                    onClick={() => addRecent(entry.emoji)}
                    title={entry.label}
                  >
                    <TwemojiImg hexcode={entry.hexcode} alt={entry.emoji} />
                  </button>
                )}
                itemHeight={38}
                columns={8}
                overscan={4}
                className="emoji-grid-virtual"
              />
            </div>
          </>
        ) : (
          <>
            <div className="emoji-section-label">
              {EMOJI_GROUP_NAMES[activeCategory]}
            </div>
            <div
              className="emoji-grid-virtual-wrapper"
              style={{ height: "400px" }}
            >
              <VirtualGrid<EmojiEntry>
                items={groupedEmojis[activeCategory] || []}
                renderItem={(entry, i) => (
                  <button
                    key={`${entry.hexcode}-${i}`}
                    className="emoji-button"
                    onClick={() => addRecent(entry.emoji)}
                    title={entry.label}
                  >
                    <TwemojiImg hexcode={entry.hexcode} alt={entry.emoji} />
                  </button>
                )}
                itemHeight={38}
                columns={8}
                overscan={4}
                className="emoji-grid-virtual"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GifPanel({
  searchTerm,
  onSelect,
  onClose,
}: {
  searchTerm: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedGifs, setSavedGifs] = useState<SavedGif[]>([]);
  const [showFavorites, setShowFavorites] = useState(true);
  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    dbFavGifs.get().then((saved) => {
      if (saved.length > 0) {
        setSavedGifs(
          saved.map((url) =>
            typeof url === "string" ? { url, savedAt: 0 } : url,
          ),
        );
      }
    });
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setShowFavorites(true);
      setResults([]);
      return;
    }
    setShowFavorites(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => searchGifs(searchTerm), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchTerm]);

  const searchGifs = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://apps.mistium.com/tenor/search?query=${encodeURIComponent(query)}`,
      );
      const data = await response.json();
      setResults(data.results || data || []);
    } catch (error) {
      console.error("Failed to search GIFs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (gifUrl: string) => {
    onSelect(gifUrl);
    onClose();
  };

  const toggleFavorite = (gifUrl: string, e: Event) => {
    e.stopPropagation();
    const existingIndex = savedGifs.findIndex((g) => g.url === gifUrl);
    let updated: SavedGif[];
    if (existingIndex >= 0) {
      updated = savedGifs.filter((_, i) => i !== existingIndex);
    } else {
      updated = [...savedGifs, { url: gifUrl, savedAt: Date.now() }];
    }
    setSavedGifs(updated);
    dbFavGifs.set(updated);
  };

  const isFavorite = (url: string) => savedGifs.some((g) => g.url === url);

  const displayGifs = showFavorites
    ? savedGifs.map((g) => ({
        id: g.url,
        previewUrl: g.url,
        fullUrl: g.url,
        title: "",
      }))
    : results.map((g) => {
        const media = g.media?.[0];
        const previewUrl = media?.tinygif?.url || media?.preview || "";
        const fullUrl = media?.gif?.url || media?.nanogif?.url || g.itemurl;
        return { id: g.id, previewUrl, fullUrl, title: g.title || "" };
      });

  return (
    <div className="unified-picker-body">
      {showFavorites && (
        <div className="gif-section-label">
          <Icon name="Star" size={14} /> Favorites
        </div>
      )}
      {loading ? (
        <div className="picker-loading">
          <div
            className="account-loading-spinner"
            style={{ width: 32, height: 32 }}
          ></div>
          <span>Searching...</span>
        </div>
      ) : displayGifs.length === 0 ? (
        <div className="picker-empty">
          {showFavorites ? (
            <>
              <Icon name="Star" size={32} />
              <p>No favorite GIFs yet</p>
              <p className="picker-empty-hint">
                Search for GIFs and star them to save
              </p>
            </>
          ) : (
            <>
              <Icon name="Search" size={32} />
              <p>No results found</p>
            </>
          )}
        </div>
      ) : (
        <div className="gif-grid">
          {displayGifs.slice(0, 50).map((gif) => (
            <div
              key={gif.id || gif.fullUrl}
              className="gif-item"
              onClick={() => handleSelect(gif.fullUrl)}
            >
              <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
              <button
                className={`gif-fav-btn ${isFavorite(gif.fullUrl) ? "active" : ""}`}
                onClick={(e: any) => toggleFavorite(gif.fullUrl, e)}
              >
                <Icon
                  name="Star"
                  size={14}
                  fill={isFavorite(gif.fullUrl) ? "currentColor" : "none"}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
