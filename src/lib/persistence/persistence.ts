import {
  token,
  servers,
  serverFolders,
  readTimesByServer,
  friends,
  friendRequests,
  blockedUsers,
  friendNicknames,
  serverNotifSettings,
  channelNotifSettings,
  unreadState,
  getOriginFS,
  DEFAULT_SERVERS,
} from "../../state";
import type { NotificationLevel } from "../../state";
import type { Server, ServerFolder } from "../../types";
import { getFriends } from "../api/rotur-api";

const APP_DATA = "/application data/chats@mistium";

async function loadJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  const originFS = getOriginFS();
  if (!originFS) return defaultValue;
  try {
    const content = await originFS.readFileContent(`${APP_DATA}/${filename}`);
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

async function saveJsonFile<T>(filename: string, data: T): Promise<void> {
  const originFS = getOriginFS();
  if (!originFS) return;
  try {
    await originFS.writeFile(`${APP_DATA}/${filename}`, JSON.stringify(data));
    await originFS.commit();
  } catch (e) {
    console.warn(`[persistence] Failed to save ${filename}:`, e);
  }
}

export async function loadServers(): Promise<Server[]> {
  const originFS = getOriginFS();
  if (!originFS) return [...DEFAULT_SERVERS];
  try {
    await originFS.loadIndex();
    const content = await originFS.readFileContent("/application data/chats@mistium/servers.json");
    return (JSON.parse(content) as Server[]).filter((s) => s.url !== "dms.mistium.com");
  } catch {
    return [...DEFAULT_SERVERS];
  }
}

export async function saveServers(): Promise<void> {
  await saveJsonFile("servers.json", servers.value);
}

export async function loadReadTimes(): Promise<Record<string, Record<string, number>>> {
  return loadJsonFile("read_times.json", {});
}

export async function saveReadTimes(): Promise<void> {
  await saveJsonFile(
    "read_times.json",
    Object.fromEntries(readTimesByServer.keys().map((k) => [k, readTimesByServer.read(k)]))
  );
}

export async function loadNotifSettings(): Promise<{
  serverNotif: Record<string, NotificationLevel>;
  channelNotif: Record<string, NotificationLevel>;
}> {
  const defaults = { serverNotif: {}, channelNotif: {} };
  const loaded = await loadJsonFile("notif_settings.json", defaults);
  return {
    serverNotif: loaded.serverNotif ?? {},
    channelNotif: loaded.channelNotif ?? {},
  };
}

export async function saveNotifSettings(): Promise<void> {
  await saveJsonFile("notif_settings.json", {
    serverNotif: serverNotifSettings.value,
    channelNotif: channelNotifSettings.value,
  });
}

async function fetchMyAccountData(): Promise<void> {
  if (!token.value) return;
  try {
    const data = await getFriends();
    friends.value = data.friends;
    friendRequests.value = data.requests;
    blockedUsers.value = data.blocked;
  } catch (error) {
    console.error("Failed to fetch account data:", error);
  }
}

export async function loadFolders(): Promise<ServerFolder[]> {
  return loadJsonFile("folders.json", []);
}

export async function saveFolders(): Promise<void> {
  await saveJsonFile("folders.json", serverFolders.value);
}

export async function loadFriendNicknames(): Promise<Record<string, string>> {
  return loadJsonFile("friend_nicknames.json", {});
}

export async function saveFriendNicknames(): Promise<void> {
  await saveJsonFile("friend_nicknames.json", friendNicknames.value);
}

async function loadPings(): Promise<{
  pings: Record<string, number>;
  unreads: Record<string, number>;
}> {
  const defaults = { pings: {}, unreads: {} };
  const loaded = await loadJsonFile("pings.json", defaults);
  return {
    pings: loaded.pings ?? {},
    unreads: loaded.unreads ?? {},
  };
}

async function savePings(): Promise<void> {
  await saveJsonFile("pings.json", {
    pings: unreadState.pings.value,
    unreads: unreadState.unreads.value,
  });
}
