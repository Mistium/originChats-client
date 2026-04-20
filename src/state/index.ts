export {
  token,
  DM_SERVER_URL,
  SPECIAL_CHANNELS,
  isSpecialChannel,
  serverUrl,
  currentChannel,
  currentThread,
  servers,
  serverFolders,
  dmServers,
  friends,
  friendRequests,
  blockedUsers,
  friendNicknames,
  replyTo,
  replyPing,
  channelsByServer,
  threadsByServer,
  threadMessagesByServer,
  newThreadCounts,
  usersByServer,
  currentUserByServer,
  rolesByServer,
  slashCommandsByServer,
  readTimesByServer,
  lastChannelByServer,
  typingUsersByServer,
  customEmojisByServer,
  missedMessagesCount,
  serverAuthModeByServer,
  serverCapabilitiesByServer,
  serverPermissionsByServer,
  attachmentConfigByServer,
  wsConnections,
  wsStatus,
  serverValidatorKeys,
  reconnectAttempts,
  reconnectTimeouts,
  pushSubscriptionsByServer,
  roturStatuses,
  roturMyGroups,
  roturFollowing,
  pingsInboxMessages,
  pingsInboxTotal,
  pingsInboxLoading,
  pingsInboxOffset,
  PINGS_INBOX_LIMIT,
  serversAttempted,
  clearServersAttempted,
  pendingDMAddUsername,
  setPendingDMAddUsername,
  setOriginFS,
  getOriginFS,
  DEFAULT_SERVERS,
  recentEmojis,
  channels,
  users,
  currentUser,
  currentServer,
  slashCommands,
  serverCapabilities,
  hasCapability,
  addThreadToChannel,
  removeThreadFromChannel,
  updateThreadInChannel,
  clearNewThreadCount,
  type WSConnection,
} from "./core";

export {
  isOffline,
  offlinePushServers,
  serverNotifSettings,
  channelNotifSettings,
  getChannelNotifLevel,
  pingSound,
  pingVolume,
  customPingSound,
  blockedMessageDisplay,
  appTheme,
  appFont,
  hideScrollbars,
  hideAvatarBorders,
  reduceMotion,
  avatarShape,
  bubbleRadius,
  accentColor,
  pingHighlightColor,
  useSystemEmojis,
  messageFontSize,
  compactMode,
  showTimestamps,
  notificationPromptDismissed,
  showEditedIndicator,
  maxInlineImageWidth,
  micThreshold,
  voiceVideoRes,
  voiceVideoFps,
  sendTypingIndicators,
  dmMessageSound,
  myStatus,
  autoIdleOnUnfocus,
  savedStatusText,
  initSettingsFromDb,
  type NotificationLevel,
  type PingSoundType,
  type BlockedMessageDisplay,
  type AppTheme,
  type AppFont,
  type AvatarShape,
  type UserStatus,
} from "./settings";

export { DEFAULT_PERMISSIONS, type ServerPermission } from "./permissions-defs";

export {
  loadedChannelsByServer,
  reachedOldestByServer,
  reachedNewestByServer,
  clearChannelLoadState,
} from "./channel-state";

export {
  messages as messageState,
  messagesByServer,
  getMessageKey,
  truncateForNotification,
  normalizeReactions,
  mergeAndSortMessages,
} from "./messages";
export { pendingMessages } from "./pending-messages";
export { unreadState } from "./unread";
export { statusState } from "./status";
export { ServerSignalStore } from "./server-store";

import { computed } from "@preact/signals";
import { serverUrl } from "./core";
import { messagesByServer } from "./messages";
import { unreadState } from "./unread";

export const messages = computed(() => messagesByServer.value[serverUrl.value] || {});

export function getServerPingCount(sUrl: string): number {
  return unreadState.getServerPing(sUrl);
}

export function getServerUnreadCount(sUrl: string): number {
  return unreadState.getServerUnread(sUrl);
}

export function getChannelPingCount(sUrl: string, channelName: string): number {
  return unreadState.getChannelPing(sUrl, channelName);
}

export function getChannelUnreadCount(sUrl: string, channelName: string): number {
  return unreadState.getChannelUnread(sUrl, channelName);
}

export function clearChannelPings(sUrl: string, channelName: string): void {
  unreadState.clearChannel(sUrl, channelName);
}

export function clearServerPings(sUrl: string): void {
  unreadState.clearServer(sUrl);
}

export function hasChannelUnreads(sUrl: string, channelName: string): boolean {
  return unreadState.hasUnreads(sUrl, channelName);
}
