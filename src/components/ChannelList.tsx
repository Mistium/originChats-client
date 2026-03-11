import { useReducer, useState } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";

import {
  serverUrl,
  currentChannel,
  channels,
  readTimesByServer,
  unreadByChannel,
  unreadPings,
  currentServer,
  currentUserByServer,
  DM_SERVER_URL,
  roturStatuses,
  channelNotifSettings,
  getChannelNotifLevel,
  type NotificationLevel,
} from "../state";
import {
  selectChannel,
  selectHomeChannel,
  selectRelationshipsChannel,
  markChannelAsRead,
} from "../lib/actions";
import {
  renderChannelsSignal,
  showSettingsModal,
  showServerSettingsModal,
  showVoiceCallView,
  mobileSidebarOpen,
  closeMobileNav,
  showContextMenu,
} from "../lib/ui-signals";
import { Icon } from "./Icon";
import { voiceManager, voiceState } from "../voice";
import { openUserPopout } from "./UserPopout";
import type { VoiceUser } from "../types";
import { avatarUrl } from "../utils";
import { updateStatus, clearStatus } from "../lib/rotur-api";

function isChannelUnread(
  channel: { name: string; last_message?: number },
  sUrl: string,
): boolean {
  const serverReadTimes = readTimesByServer.value[sUrl];
  if (!serverReadTimes || Object.keys(serverReadTimes).length === 0) {
    return false;
  }
  const readTime = serverReadTimes[channel.name] || 0;
  return (channel.last_message || 0) > readTime;
}

export function ChannelList() {
  const [, forceUpdate] = useReducer((n) => n + 1, 0);
  useSignalEffect(() => {
    renderChannelsSignal.value; // subscribe to channel changes
    voiceState.value; // re-render when voice state changes
    showVoiceCallView.value; // re-render when call view opens/closes
    forceUpdate(undefined);
  });
  const isDM = serverUrl.value === DM_SERVER_URL;
  const rawChs = channels.value;
  const chs = isDM
    ? [...rawChs].sort(
        (a, b) =>
          ((b as any).last_message || 0) - ((a as any).last_message || 0),
      )
    : rawChs;
  let separatorIndex = 0;

  const voice = voiceState.value;
  const isInVoice = !!voice.currentChannel;
  const myUsername = currentUserByServer.value[serverUrl.value]?.username;

  // When the voice call view is open for a dedicated voice channel (not a chat
  // channel), suppress the text-channel active highlight so only the voice
  // channel entry shows as selected.
  const voiceChannelActive =
    showVoiceCallView.value &&
    voice.currentChannel !== null &&
    channels.value.find(
      (c) => c.name === voice.currentChannel && c.type === "voice",
    ) !== undefined;

  const handleChannelClick = (channel: any) => {
    if (channel.type === "voice") {
      voiceManager.joinChannel(channel.name, myUsername);
    } else {
      selectChannel(channel);
    }
    // close nav on mobile after selecting a channel
    closeMobileNav();
  };

  const handleChannelContextMenu = (e: MouseEvent, channel: any) => {
    e.preventDefault();
    const sUrl = serverUrl.value;
    const channelKey = `${sUrl}:${channel.name}`;
    const currentLevel = getChannelNotifLevel(sUrl, channel.name);

    const setChannelNotif = (level: NotificationLevel) => {
      if (level === "mentions") {
        // "mentions" is the default — remove any override so server/global default applies
        const next = { ...channelNotifSettings.value };
        delete next[channelKey];
        channelNotifSettings.value = next;
      } else {
        channelNotifSettings.value = {
          ...channelNotifSettings.value,
          [channelKey]: level,
        };
      }
    };

    showContextMenu(e, [
      {
        label: "Mark as Read",
        icon: "CheckCircle",
        fn: () => markChannelAsRead(channel.name),
      },
      { separator: true, label: "", fn: () => {} },
      {
        label: "Notifications",
        icon: "Bell",
        fn: () => {},
        children: [
          {
            label: `All Messages${currentLevel === "all" ? " ✓" : ""}`,
            icon: "Bell",
            fn: () => setChannelNotif("all"),
          },
          {
            label: `Mentions Only${currentLevel === "mentions" ? " ✓" : ""}`,
            icon: "BellDot",
            fn: () => setChannelNotif("mentions"),
          },
          {
            label: `Mute${currentLevel === "none" ? " ✓" : ""}`,
            icon: "BellOff",
            fn: () => setChannelNotif("none"),
          },
        ],
      },
      { separator: true, label: "", fn: () => {} },
      {
        label: "Copy Channel Name",
        icon: "Copy",
        fn: () => {
          navigator.clipboard.writeText(channel.name);
        },
      },
    ]);
  };

  return (
    <div
      id="channels"
      className={`channels${mobileSidebarOpen.value ? " open" : ""}`}
    >
      <div className="channel-header">
        <div className="channel-header-info">
          <div className="channel-header-name">
            {isDM ? "Direct Messages" : currentServer.value?.name || "Server"}
          </div>
        </div>
        {!isDM && (
          <button
            className="channel-header-settings"
            onClick={() => (showServerSettingsModal.value = true)}
            title="Server Settings"
          >
            <Icon name="Settings" size={16} />
          </button>
        )}
        <button
          className="channel-header-close"
          onClick={closeMobileNav}
          aria-label="Close"
        >
          <Icon name="X" size={18} />
        </button>
      </div>
      <div className="channels-list">
        {isDM && (
          <>
            <div
              className={`channel-item ${currentChannel.value?.name === "home" ? "active" : ""}`}
              onClick={selectHomeChannel}
            >
              <Icon name="Home" size={18} />
              <span>Home</span>
            </div>
            <div
              className={`channel-item ${currentChannel.value?.name === "relationships" ? "active" : ""}`}
              onClick={selectRelationshipsChannel}
            >
              <Icon name="Users" size={18} />
              <span>Friends</span>
            </div>
            <div
              className={`channel-item ${currentChannel.value?.name === "notes" ? "active" : ""}`}
              onClick={() =>
                selectChannel({
                  name: "notes",
                  type: "text",
                  display_name: "Notes",
                })
              }
            >
              <Icon name="FileText" size={18} />
              <span>Notes</span>
            </div>
            <div
              className={`channel-item ${currentChannel.value?.name === "new_message" ? "active" : ""}`}
              onClick={() =>
                selectChannel({
                  name: "new_message",
                  type: "new_message",
                  display_name: "New Message",
                })
              }
            >
              <Icon name="PenSquare" size={16} />
              <span>New Message</span>
            </div>
            <div className="channel-separator" style={{ height: "8px" }} />
          </>
        )}
        {chs.map((channel) => {
          if (isDM && channel.name === "cmds") return null;
          if (isDM && channel.type === "separator") return null;

          if (channel.type === "separator") {
            separatorIndex++;
            return (
              <div
                key={`separator-${separatorIndex}`}
                className="channel-separator"
                style={{ height: ((channel as any).size || 20) + "px" }}
              />
            );
          }

          const isVoice = channel.type === "voice";
          const displayName = (channel as any).display_name || channel.name;
          const notifLevel = getChannelNotifLevel(
            serverUrl.value,
            channel.name,
          );
          const isMuted = notifLevel === "none";
          const hasUnread =
            !isMuted &&
            (isChannelUnread(channel, serverUrl.value) ||
              unreadByChannel.value[`${serverUrl.value}:${channel.name}`] > 0);
          const hasPing = unreadPings.value[channel.name] > 0;

          const voiceUsers: VoiceUser[] = (channel as any).voice_state || [];

          if (isVoice) {
            return (
              <div key={channel.name} className="voice-channel-wrapper">
                <div
                  className={`channel-item ${voice.currentChannel === channel.name ? "active" : ""}`}
                  onClick={() => handleChannelClick(channel)}
                  onContextMenu={(e: any) =>
                    handleChannelContextMenu(e, channel)
                  }
                >
                  <Icon name="Mic" size={18} />
                  {(channel as any).icon && (
                    <img
                      src={(channel as any).icon}
                      className="channel-item-icon"
                    />
                  )}
                  <span>{displayName}</span>
                  {voiceUsers.length > 0 && (
                    <span className="voice-user-count">
                      {voiceUsers.length}
                    </span>
                  )}
                </div>
                {voiceUsers.length > 0 && (
                  <div className="voice-channel-user-list">
                    {voiceUsers.map((vu) => (
                      <div
                        key={vu.username}
                        className={`voice-channel-user${vu.muted ? " muted" : ""}`}
                        onClick={(e: any) => openUserPopout(e, vu.username)}
                      >
                        <div className="voice-channel-user-avatar">
                          <img
                            src={vu.pfp || avatarUrl(vu.username)}
                            alt={vu.username}
                          />
                        </div>
                        <span className="voice-channel-username">
                          {vu.username}
                        </span>
                        {vu.muted && <Icon name="MicOff" size={14} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={channel.name}
              className={`channel-item ${!voiceChannelActive && currentChannel.value?.name === channel.name ? "active" : ""} ${hasUnread ? "has-unread" : ""} ${isMuted ? "muted" : ""}`}
              onClick={() => handleChannelClick(channel)}
              onContextMenu={(e: any) => handleChannelContextMenu(e, channel)}
            >
              {isDM && channel.icon ? (
                <img
                  src={channel.icon}
                  alt={channel.display_name || channel.name}
                  className="channel-item-dm-avatar"
                />
              ) : (
                <>
                  <Icon name="Hash" size={18} />
                  {channel.icon && (
                    <img src={channel.icon} className="channel-item-icon" />
                  )}
                </>
              )}
              <span>{displayName}</span>
              {isMuted && !hasPing && (
                <span
                  style={{ marginLeft: "auto", opacity: 0.4, display: "flex" }}
                >
                  <Icon name="BellOff" size={14} />
                </span>
              )}
              {hasPing && (
                <span className="ping-badge">
                  {unreadPings.value[channel.name]}
                </span>
              )}
              {hasUnread && !hasPing && (
                <span className="unread-indicator"></span>
              )}
            </div>
          );
        })}
      </div>

      {isInVoice && (
        <div className="voice-panel active">
          <div className="voice-panel-info">
            <div className="voice-panel-status">
              <Icon name="Wifi" size={14} />
              <span>Voice Connected</span>
            </div>
            <div className="voice-panel-channel">{voice.currentChannel}</div>
          </div>
          <div className="voice-panel-controls">
            <button
              className={`voice-control-btn ${voice.isMuted ? "muted" : ""}`}
              onClick={() => voiceManager.toggleMute()}
              title={voice.isMuted ? "Unmute" : "Mute"}
            >
              <Icon name={voice.isMuted ? "MicOff" : "Mic"} size={18} />
            </button>
            <button
              className={`voice-control-btn ${voice.isCameraOn ? "active" : ""}`}
              onClick={() => voiceManager.toggleCamera()}
              title={voice.isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
            >
              <Icon name={voice.isCameraOn ? "VideoOff" : "Video"} size={18} />
            </button>
            <button
              className={`voice-control-btn ${voice.isScreenSharing ? "active" : ""}`}
              onClick={() => voiceManager.toggleScreenShare()}
              title={voice.isScreenSharing ? "Stop Sharing" : "Share Screen"}
            >
              <Icon
                name={voice.isScreenSharing ? "MonitorOff" : "Monitor"}
                size={18}
              />
            </button>
            <button
              className="voice-control-btn"
              onClick={() => {
                showVoiceCallView.value = !showVoiceCallView.value;
              }}
              title="Open Call View"
            >
              <Icon name="Maximize2" size={18} />
            </button>
            <button
              className="voice-control-btn voice-leave-btn"
              onClick={() => voiceManager.leaveChannel()}
              title="Disconnect"
            >
              <Icon name="PhoneOff" size={18} />
            </button>
          </div>
        </div>
      )}

      <UserPanel />
    </div>
  );
}

// ── User panel ────────────────────────────────────────────────────────────────

function UserPanel() {
  const sUrl = serverUrl.value;
  const username = currentUserByServer.value[sUrl]?.username;

  if (!username) return null;

  return (
    <div className="channel-user-panel">
      <div className="channel-user-panel-identity">
        <div className="channel-user-panel-avatar">
          <img src={avatarUrl(username)} alt={username} />
        </div>
        <div className="channel-user-panel-info">
          <div className="channel-user-panel-name">{username}</div>
        </div>
      </div>
      <button
        className="channel-user-panel-btn"
        title="Open Settings"
        onClick={() => (showSettingsModal.value = true)}
      >
        <Icon name="Settings" size={16} />
      </button>
    </div>
  );
}

// ── Status modal ──────────────────────────────────────────────────────────────

function StatusModal({
  username,
  current,
  onClose,
}: {
  username: string;
  current: { content?: string } | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState(current?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      await updateStatus(content.trim());
      roturStatuses.value = {
        ...roturStatuses.value,
        [username.toLowerCase()]: { content: content.trim() },
      };
      onClose();
    } catch (e: any) {
      setMsg(e.message || "Failed to save");
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setMsg("");
    try {
      await clearStatus();
      const updated = { ...roturStatuses.value };
      delete updated[username.toLowerCase()];
      roturStatuses.value = updated;
      onClose();
    } catch (e: any) {
      setMsg(e.message || "Failed to clear");
      setSaving(false);
    }
  };

  return (
    <div
      className="status-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="status-modal">
        <div className="status-modal-header">
          <span>Set Status</span>
          <button className="status-modal-close" onClick={onClose}>
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="status-modal-body">
          <input
            className="status-modal-text"
            type="text"
            placeholder="What's on your mind? (emoji welcome 😊)"
            value={content}
            onInput={(e) => setContent((e.target as HTMLInputElement).value)}
            maxLength={250}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            autoFocus
          />
          {msg && <div className="status-modal-error">{msg}</div>}
        </div>
        <div className="status-modal-footer">
          <button
            className="status-modal-btn secondary"
            onClick={handleClear}
            disabled={saving}
          >
            Clear
          </button>
          <button
            className="status-modal-btn primary"
            onClick={handleSave}
            disabled={saving || !content.trim()}
          >
            {saving ? "Saving…" : "Set Status"}
          </button>
        </div>
      </div>
    </div>
  );
}
