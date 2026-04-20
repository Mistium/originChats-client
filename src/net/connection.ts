import {
  serverUrl,
  channelsByServer,
  threadsByServer,
  threadMessagesByServer,
  messageState,
  loadedChannelsByServer,
  reachedOldestByServer,
  usersByServer,
  currentUserByServer,
  typingUsersByServer,
  wsConnections,
  wsStatus,
  serverValidatorKeys,
  reconnectAttempts,
  reconnectTimeouts,
  serversAttempted,
  rolesByServer,
  slashCommandsByServer,
  readTimesByServer,
  serverCapabilitiesByServer,
  serverAuthModeByServer,
} from "../state";
import {
  renderGuildSidebarSignal,
  renderChannelsSignal,
  renderMessagesSignal,
  renderMembersSignal,
  dismissBanner,
  pendingCrackedCredentials,
} from "../lib/ui-signals";

const reconnectBannerIds: Record<string, string> = {};

export function clearServerState(sUrl: string): void {
  channelsByServer.delete(sUrl);
  messageState.clear(sUrl);
  threadsByServer.delete(sUrl);
  threadMessagesByServer.delete(sUrl);
  usersByServer.delete(sUrl);
  currentUserByServer.delete(sUrl);
  rolesByServer.delete(sUrl);
  slashCommandsByServer.delete(sUrl);
  typingUsersByServer.delete(sUrl);
  serverCapabilitiesByServer.delete(sUrl);
  serverAuthModeByServer.delete(sUrl);
  delete loadedChannelsByServer[sUrl];
  delete reachedOldestByServer[sUrl];
  readTimesByServer.delete(sUrl);
  if (pendingCrackedCredentials.value?.serverUrl === sUrl) {
    pendingCrackedCredentials.value = null;
  }
  renderChannelsSignal.value++;
  renderMessagesSignal.value++;
  renderMembersSignal.value++;
}

export function closeWebSocket(url: string): void {
  clearServerState(url);
  if (reconnectTimeouts[url]) {
    clearTimeout(reconnectTimeouts[url]);
    delete reconnectTimeouts[url];
  }
  reconnectAttempts[url] = 0;
  const bannerId = reconnectBannerIds[url] || `reconnect-${url}`;
  dismissBanner(bannerId);
  delete reconnectBannerIds[url];
  const conn = wsConnections[url];
  if (!conn) return;
  if (conn.socket) {
    if (conn.closeHandler) conn.socket.removeEventListener("close", conn.closeHandler);
    if (conn.errorHandler) conn.socket.removeEventListener("error", conn.errorHandler);
    if (conn.socket.readyState !== WebSocket.CLOSED) conn.socket.close();
  }
  delete wsConnections[url];
  delete wsStatus[url];
}
