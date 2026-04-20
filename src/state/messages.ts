import { signal } from "@preact/signals";
import type { Message } from "../types";

type ServerUrl = string;
type ChannelKey = string;

const MAX_MESSAGES = 200;

const _byServer = signal<Record<ServerUrl, Record<ChannelKey, Message[]>>>({});
const _version = signal(0);

function trim(arr: Message[]): Message[] {
  return arr.length > MAX_MESSAGES ? arr.slice(-MAX_MESSAGES) : arr;
}

export function getMessageKey(msg: { thread_id?: string; channel: string }): string {
  return msg.thread_id || msg.channel;
}

export function truncateForNotification(content: string, maxLength = 100): string {
  const clean = (content || "").replace(/<[^>]*>/g, "");
  return clean.length > maxLength ? clean.substring(0, maxLength) + "..." : clean;
}

export function normalizeReactions(messages: Message[]): Message[] {
  return messages.map((m) => {
    const normalised: Record<string, string[]> = {};
    if (m.reactions && typeof m.reactions === "object") {
      for (const [emoji, reactors] of Object.entries(m.reactions)) {
        normalised[emoji] = reactors as string[];
      }
    }
    return { ...m, reactions: normalised };
  });
}

export function mergeAndSortMessages(existing: Message[], incoming: Message[]): Message[] {
  const all = [...existing, ...incoming];
  const uniqueMap = new Map(all.map((m) => [m.id, m]));
  return Array.from(uniqueMap.values()).sort((a, b) => a.timestamp - b.timestamp);
}

class MessageStore {
  private getServerMessages(url: ServerUrl): Record<ChannelKey, Message[]> {
    return _byServer.value[url] || {};
  }

  private getChannelMessages(url: ServerUrl, channel: ChannelKey): Message[] {
    return this.getServerMessages(url)[channel] || [];
  }

  private sync() {
    _version.value++;
  }

  get(url: ServerUrl, channel: ChannelKey): Message[] {
    return this.getChannelMessages(url, channel);
  }

  getMostRecent(url: ServerUrl, channel: ChannelKey): Message | null {
    const msgs = this.getChannelMessages(url, channel);
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  }

  append(url: ServerUrl, channel: ChannelKey, msg: Message): void {
    const serverMsgs = this.getServerMessages(url);
    const existing = serverMsgs[channel] || [];
    if (existing.some((m) => m.id === msg.id)) return;
    _byServer.value = {
      ..._byServer.value,
      [url]: { ...serverMsgs, [channel]: trim([...existing, msg]) },
    };
    this.sync();
  }

  prepend(url: ServerUrl, channel: ChannelKey, msgs: Message[]): void {
    const serverMsgs = this.getServerMessages(url);
    const existing = serverMsgs[channel] || [];
    const existingIds = new Set(existing.map((m) => m.id));
    const newOnes = msgs.filter((m) => !existingIds.has(m.id));
    _byServer.value = {
      ..._byServer.value,
      [url]: { ...serverMsgs, [channel]: trim([...newOnes, ...existing]) },
    };
    this.sync();
  }

  set(url: ServerUrl, channel: ChannelKey, msgs: Message[]): void {
    const serverMsgs = this.getServerMessages(url);
    _byServer.value = {
      ..._byServer.value,
      [url]: { ...serverMsgs, [channel]: trim(msgs) },
    };
    this.sync();
  }

  setRaw(url: ServerUrl, channel: ChannelKey, msgs: Message[]): void {
    const serverMsgs = this.getServerMessages(url);
    _byServer.value = {
      ..._byServer.value,
      [url]: { ...serverMsgs, [channel]: msgs },
    };
    this.sync();
  }

  update(url: ServerUrl, channel: ChannelKey, id: string, patch: Partial<Message>): boolean {
    const serverMsgs = this.getServerMessages(url);
    const arr = serverMsgs[channel];
    if (!arr) return false;
    const idx = arr.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    const updated = [...arr];
    updated[idx] = { ...updated[idx], ...patch };
    _byServer.value = {
      ..._byServer.value,
      [url]: { ...serverMsgs, [channel]: updated },
    };
    this.sync();
    return true;
  }

  delete(url: ServerUrl, channel: ChannelKey, id: string): boolean {
    const serverMsgs = this.getServerMessages(url);
    const arr = serverMsgs[channel];
    if (!arr) return false;
    const filtered = arr.filter((m) => m.id !== id);
    if (filtered.length === arr.length) return false;
    _byServer.value = {
      ..._byServer.value,
      [url]: { ...serverMsgs, [channel]: filtered },
    };
    this.sync();
    return true;
  }

  insert(url: ServerUrl, channel: ChannelKey, msg: Message): void {
    const serverMsgs = this.getServerMessages(url);
    const existing = serverMsgs[channel] || [];
    if (existing.some((m) => m.id === msg.id)) return;
    const insertIdx = existing.findIndex((m) => m.timestamp > msg.timestamp);
    const newMessages =
      insertIdx === -1
        ? [...existing, msg]
        : [...existing.slice(0, insertIdx), msg, ...existing.slice(insertIdx)];
    _byServer.value = {
      ..._byServer.value,
      [url]: { ...serverMsgs, [channel]: trim(newMessages) },
    };
    this.sync();
  }

  clear(url: ServerUrl, channel?: ChannelKey): void {
    if (channel) {
      const serverMsgs = this.getServerMessages(url);
      const { [channel]: _, ...rest } = serverMsgs;
      _byServer.value = { ..._byServer.value, [url]: rest };
    } else {
      const { [url]: _, ...rest } = _byServer.value;
      _byServer.value = rest;
    }
    this.sync();
  }

  clearAll(): void {
    _byServer.value = {};
    this.sync();
  }

  setCurrentChannel(_url: ServerUrl | null, _channel: ChannelKey | null): void {}

  get byServer() {
    return _byServer;
  }

  get version() {
    return _version.value;
  }

  readonly versionSignal = _version;
}

export const messages = new MessageStore();

export { _byServer as messagesByServer };
