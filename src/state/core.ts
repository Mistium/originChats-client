/**
 * core.ts — Core application signals
 *
 * Server connections, navigation state, user/social data, and
 * WebSocket connection tracking. No UI preferences, no theme logic.
 */
import { signal, computed } from "@preact/signals";
import { ServerSignalStore } from "./server-store";
import type {
  Channel,
  ServerUser,
  Server,
  ServerFolder,
  DMServer,
  Role,
  RoturAccount,
  SlashCommand,
  RoturGroup,
  RoturStatusUpdate,
  Thread,
  CustomEmoji,
  Webhook,
} from "../types";

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const token = signal<string | null>(null);

// ─── Constants ──────────────────────────────────────────────────────────────────
export const DM_SERVER_URL = "dms.mistium.com";

export const SPECIAL_CHANNELS = new Set([
  "home",
  "relationships",
  "notes",
  "cmds",
  "new_message",
  "discovery",
  "roles",
]);

export function isSpecialChannel(name: string, url: string): boolean {
  return SPECIAL_CHANNELS.has(name) && url === DM_SERVER_URL;
}

// ─── Navigation ────────────────────────────────────────────────────────────────
export const serverUrl = signal(DM_SERVER_URL);
export const currentChannel = signal<Channel | null>(null);
export const currentThread = signal<Thread | null>(null);

// ─── Server list ───────────────────────────────────────────────────────────────
export const servers = signal<Server[]>([]);
export const serverFolders = signal<ServerFolder[]>([]);
export const dmServers = signal<DMServer[]>([]);

// ─── Social ─────────────────────────────────────────────────────────────────────
export const friends = signal<string[]>([]);
export const friendRequests = signal<string[]>([]);
export const blockedUsers = signal<string[]>([]);
export const friendNicknames = signal<Record<string, string>>({});
export const replyTo = signal<import("../types").Message | null>(null);
export const replyPing = signal<boolean>(true);

// ─── Per-server stores ──────────────────────────────────────────────────────────
export const channelsByServer = new ServerSignalStore<Channel[]>(() => []);
export const threadsByServer = new ServerSignalStore<Record<string, Thread[]>>(() => ({}));
export const threadMessagesByServer = new ServerSignalStore<
  Record<string, import("../types").Message[]>
>(() => ({}));
export const newThreadCounts = new ServerSignalStore<Record<string, number>>(() => ({}));
export const usersByServer = new ServerSignalStore<Record<string, ServerUser>>(() => ({}));
export const currentUserByServer = new ServerSignalStore<RoturAccount | undefined>(() => undefined);
export const rolesByServer = new ServerSignalStore<Record<string, Role>>(() => ({}));
export const slashCommandsByServer = new ServerSignalStore<SlashCommand[]>(() => []);
export const readTimesByServer = new ServerSignalStore<Record<string, number>>(() => ({}));
export const lastChannelByServer = new ServerSignalStore<string>(() => "");
export const typingUsersByServer = new ServerSignalStore<Record<string, Map<string, number>>>(
  () => ({})
);
export const customEmojisByServer = new ServerSignalStore<Record<string, CustomEmoji>>(() => ({}));

export const missedMessagesCount = new ServerSignalStore<Record<string, number>>(() => ({}));

type AuthMode = "rotur" | "cracked" | "cracked-only";
export const serverAuthModeByServer = new ServerSignalStore<AuthMode>(() => "rotur" as AuthMode);
export const serverCapabilitiesByServer = new ServerSignalStore<string[]>(() => []);
export const serverPermissionsByServer = new ServerSignalStore<
  import("./permissions-defs").ServerPermission[]
>(() => []);
export const attachmentConfigByServer = new ServerSignalStore<AttachmentConfig | undefined>(
  () => undefined
);

// ─── WS connection tracking ─────────────────────────────────────────────────────
export interface WSConnection {
  socket: WebSocket | null;
  status: "connecting" | "connected" | "disconnected" | "error";
  closeHandler?: () => void;
  errorHandler?: () => void;
}

export const wsConnections: Record<string, WSConnection> = {};
export const wsStatus: Record<string, "connecting" | "connected" | "disconnected" | "error"> = {};
export const serverValidatorKeys: Record<string, string> = {};
export const reconnectAttempts: Record<string, number> = {};
export const reconnectTimeouts: Record<string, number> = {};
export const pushSubscriptionsByServer: Record<string, PushSubscriptionJSON> = {};

// ─── Rotur social ───────────────────────────────────────────────────────────────
export const roturStatuses = signal<Record<string, RoturStatusUpdate>>({});
export const roturMyGroups = signal<RoturGroup[]>([]);
export const roturFollowing = signal<Set<string>>(new Set());

// ─── Pings inbox ────────────────────────────────────────────────────────────────
interface PingMessage {
  id: string;
  user: string;
  content: string;
  timestamp: number;
  type: string;
  pinned: boolean;
  channel: string;
  reply_to?: { id: string; user: string; content?: string };
}

export const pingsInboxMessages = signal<PingMessage[]>([]);
export const pingsInboxTotal = signal<number>(0);
export const pingsInboxLoading = signal<boolean>(false);
export const pingsInboxOffset = signal<number>(0);
export const PINGS_INBOX_LIMIT = 50;

// ─── Misc mutable state ─────────────────────────────────────────────────────────
export const serversAttempted: Set<string> = new Set();
export function clearServersAttempted(): void {
  serversAttempted.clear();
}

export let pendingDMAddUsername: string | null = null;
export function setPendingDMAddUsername(username: string | null) {
  pendingDMAddUsername = username;
}

let originFS: any = null;
export function setOriginFS(fs: any) {
  originFS = fs;
}
export function getOriginFS() {
  return originFS;
}

export const DEFAULT_SERVERS: Server[] = [];
export const recentEmojis = signal<string[]>([]);

// ─── Computed helpers ────────────────────────────────────────────────────────────
export const channels = computed(() => channelsByServer.get(serverUrl.value).value);
export const users = computed(() => usersByServer.get(serverUrl.value).value);
export const currentUser = computed(() => currentUserByServer.get(serverUrl.value).value);
export const currentServer = computed(() => servers.value.find((s) => s.url === serverUrl.value));
export const slashCommands = computed(() => slashCommandsByServer.get(serverUrl.value).value);
export const serverCapabilities = computed(
  () => serverCapabilitiesByServer.get(serverUrl.value).value
);

export function hasCapability(cap: string): boolean {
  return serverCapabilities.value.includes(cap);
}

// ─── Thread helpers ─────────────────────────────────────────────────────────────
export function addThreadToChannel(url: string, channelName: string, thread: Thread) {
  const channelThreads = threadsByServer.read(url)[channelName] || [];
  threadsByServer.update(url, (current) => ({
    ...current,
    [channelName]: [...channelThreads, thread],
  }));
  newThreadCounts.update(url, (currentCounts) => ({
    ...currentCounts,
    [channelName]: (currentCounts[channelName] || 0) + 1,
  }));
}

export function removeThreadFromChannel(url: string, channelName: string, threadId: string) {
  const channelThreads = threadsByServer.read(url)[channelName] || [];
  threadsByServer.update(url, (current) => ({
    ...current,
    [channelName]: channelThreads.filter((t) => t.id !== threadId),
  }));
}

export function updateThreadInChannel(
  url: string,
  channelName: string,
  threadId: string,
  update: Partial<Thread>
) {
  const channelThreads = threadsByServer.read(url)[channelName] || [];
  const idx = channelThreads.findIndex((t) => t.id === threadId);
  if (idx !== -1) {
    const updated = [...channelThreads];
    updated[idx] = { ...updated[idx], ...update };
    threadsByServer.update(url, (current) => ({
      ...current,
      [channelName]: updated,
    }));
  }
}

export function clearNewThreadCount(url: string, channelName: string) {
  const currentCounts = newThreadCounts.read(url);
  if (currentCounts[channelName]) {
    const { [channelName]: _, ...rest } = currentCounts;
    newThreadCounts.set(url, rest);
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────────
interface AttachmentConfig {
  enabled: boolean;
  max_size: number;
  allowed_types: string[];
  max_attachments_per_user: number;
  permanent_tiers: string[];
}
