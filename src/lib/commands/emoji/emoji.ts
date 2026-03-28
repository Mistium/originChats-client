import type {
  EmojiGetAll,
  EmojiAdd,
  EmojiDelete,
  EmojiUpdate,
} from "@/msgTypes";
import type { CustomEmoji } from "../../../types";
import { customEmojisByServer } from "../../../state";

export function handleEmojiGetAll(msg: EmojiGetAll, sUrl: string): void {
  const emojis: Record<string, { name: string; fileName: string }> =
    msg.emojis || {};
  const mapped: Record<string, CustomEmoji> = {};
  for (const [id, e] of Object.entries(emojis)) {
    mapped[id] = { id, name: e.name, fileName: e.fileName };
  }
  customEmojisByServer.value = {
    ...customEmojisByServer.value,
    [sUrl]: mapped,
  };
}

export function handleEmojiAdd(msg: EmojiAdd, sUrl: string): void {
  if (msg.added && msg.id !== undefined) {
    const newEmoji: CustomEmoji = {
      id: String(msg.id),
      name: msg.name,
      fileName: msg.fileName || `${msg.id}`,
    };
    const current = customEmojisByServer.value[sUrl] || {};
    customEmojisByServer.value = {
      ...customEmojisByServer.value,
      [sUrl]: { ...current, [newEmoji.id]: newEmoji },
    };
  }
}

export function handleEmojiDelete(msg: EmojiDelete, sUrl: string): void {
  if (msg.deleted) {
    const current = customEmojisByServer.value[sUrl] || {};
    const updated = { ...current };
    delete updated[String(msg.id)];
    customEmojisByServer.value = {
      ...customEmojisByServer.value,
      [sUrl]: updated,
    };
  }
}

export function handleEmojiUpdate(msg: EmojiUpdate, sUrl: string): void {
  if (msg.updated && msg.id !== undefined) {
    const current = customEmojisByServer.value[sUrl] || {};
    const existing = current[String(msg.id)];
    if (existing) {
      customEmojisByServer.value = {
        ...customEmojisByServer.value,
        [sUrl]: {
          ...current,
          [String(msg.id)]: {
            ...existing,
            ...(msg.name ? { name: msg.name } : {}),
            ...(msg.fileName ? { fileName: msg.fileName } : {}),
          },
        },
      };
    }
  }
}
