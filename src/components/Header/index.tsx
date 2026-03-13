import { useReducer } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";
import {
  currentServer,
  currentChannel,
  serverPingsByServer,
  unreadByChannel,
  DM_SERVER_URL,
  dmServers,
  serverUrl,
  serverCapabilities,
  pingsInboxLoading,
  pingsInboxMessages,
  pingsInboxOffset,
  PINGS_INBOX_LIMIT,
} from "../../state";
import { Icon } from "../Icon";
import {
  mobileSidebarOpen,
  mobilePanelOpen,
  rightPanelView,
  showVoiceCallView,
  pinnedLoading,
  pinnedMessages,
} from "../../lib/ui-signals";
import { CallButton } from "../buttons/CallButton";
import { wsSend } from "../../lib/websocket";
import { avatarUrl } from "../../utils";
import "./Header.css";

const SPECIAL_CHANNELS = new Set(["friends", "requests", "blocked", "groups"]);

export function Header() {
  const [, forceUpdate] = useReducer((n) => n + 1, 0);
  useSignalEffect(() => {
    currentChannel.value;
    serverPingsByServer.value;
    unreadByChannel.value;
    serverUrl.value;
    showVoiceCallView.value;
    serverCapabilities.value;
    rightPanelView.value;
    mobilePanelOpen.value;
    forceUpdate(undefined);
  });

  const isDM = serverUrl.value === DM_SERVER_URL;
  const ch = currentChannel.value;
  const isChatChannel = ch !== null && ch.type === "chat";
  const caps = serverCapabilities.value;
  const canPin =
    caps.includes("message_pin") && caps.includes("messages_pinned");
  const canSearch = caps.includes("messages_search");
  const canInbox = caps.includes("pings_get");

  const serverPingTotal = Object.values(serverPingsByServer.value).reduce(
    (a, b) => a + b,
    0,
  );
  const dmPingTotal = dmServers.value.reduce(
    (sum, dm) =>
      sum + (unreadByChannel.value[`${DM_SERVER_URL}:${dm.channel}`] || 0),
    0,
  );
  const totalPings = serverPingTotal + dmPingTotal;

  const toggleSidebar = () => {
    mobileSidebarOpen.value = !mobileSidebarOpen.value;
    if (mobileSidebarOpen.value) mobilePanelOpen.value = false;
  };

  const togglePanel = (panel: "members" | "pinned" | "search" | "inbox") => {
    const isDesktop = window.innerWidth >= 769;

    if (isDesktop) {
      if (rightPanelView.value === panel) {
        rightPanelView.value = null;
      } else {
        rightPanelView.value = panel;
        fetchPanelData(panel);
      }
    } else {
      if (rightPanelView.value === panel && mobilePanelOpen.value) {
        mobilePanelOpen.value = false;
      } else {
        rightPanelView.value = panel;
        mobilePanelOpen.value = true;
        mobileSidebarOpen.value = false;
        fetchPanelData(panel);
      }
    }
  };

  const fetchPanelData = (panel: "members" | "pinned" | "search" | "inbox") => {
    if (panel === "pinned" && canPin) {
      pinnedLoading.value = true;
      pinnedMessages.value = [];
      wsSend({
        cmd: "messages_pinned",
        channel: currentChannel.value?.name,
      });
    }
    if (panel === "inbox" && canInbox) {
      pingsInboxLoading.value = true;
      pingsInboxMessages.value = [];
      pingsInboxOffset.value = 0;
      wsSend({ cmd: "pings_get", limit: PINGS_INBOX_LIMIT, offset: 0 });
    }
  };

  const renderMobileHeader = () => (
    <div className="header">
      <button
        className="menu-btn"
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
      >
        <Icon name="Menu" size={24} />
        {totalPings > 0 && !mobileSidebarOpen.value && (
          <span className="menu-btn-ping-badge">
            {totalPings > 99 ? "99+" : totalPings}
          </span>
        )}
      </button>
      <div className="server-info">
        <div className="header-text">
          <div className="server-name">
            <span>{currentServer.value?.name || "Direct Messages"}</span>
          </div>
          <div className="channel-name">
            #
            {currentChannel.value?.display_name ||
              currentChannel.value?.name ||
              "home"}
          </div>
        </div>
      </div>
      <div className="header-actions">
        {isChatChannel && <CallButton className="header-btn" />}
        {canSearch && (
          <button
            className={`header-btn ${rightPanelView.value === "search" && mobilePanelOpen.value ? "active" : ""}`}
            onClick={() => togglePanel("search")}
            aria-label="Search"
          >
            <Icon name="Search" />
          </button>
        )}
        {canPin && (
          <button
            className={`header-btn ${rightPanelView.value === "pinned" && mobilePanelOpen.value ? "active" : ""}`}
            onClick={() => togglePanel("pinned")}
            aria-label="Pinned messages"
          >
            <Icon name="Pin" />
          </button>
        )}
        {canInbox && (
          <button
            className={`header-btn ${rightPanelView.value === "inbox" && mobilePanelOpen.value ? "active" : ""}`}
            onClick={() => togglePanel("inbox")}
            aria-label="Inbox"
          >
            <Icon name="Bell" />
          </button>
        )}
        {!isDM && (
          <button
            className={`header-btn ${rightPanelView.value === "members" && mobilePanelOpen.value ? "active" : ""}`}
            onClick={() => togglePanel("members")}
            aria-label="Members"
          >
            <Icon name="Users" />
          </button>
        )}
      </div>
    </div>
  );

  const renderDesktopHeader = () => (
    <div className="main-messages-header">
      <div className="main-header-left">
        <Icon name="Hash" size={24} />
        <span className="main-header-channel-name">
          {currentChannel.value?.display_name ||
            currentChannel.value?.name ||
            "home"}
        </span>
      </div>
      <div className="main-header-right">
        {isChatChannel && (
          <CallButton className="header-icon-btn" iconSize={20} />
        )}
        {canInbox && (
          <button
            className={`header-icon-btn ${rightPanelView.value === "inbox" ? "active" : ""}`}
            onClick={() => togglePanel("inbox")}
            title="Inbox"
          >
            <Icon name="Bell" size={20} />
          </button>
        )}
        {canPin && (
          <button
            className={`header-icon-btn ${rightPanelView.value === "pinned" ? "active" : ""}`}
            onClick={() => togglePanel("pinned")}
            title="Pinned Messages"
          >
            <Icon name="Pin" size={20} />
          </button>
        )}
        {canSearch && (
          <button
            className={`header-icon-btn ${rightPanelView.value === "search" ? "active" : ""}`}
            onClick={() => togglePanel("search")}
            title="Search"
          >
            <Icon name="Search" size={20} />
          </button>
        )}
        {!isDM && (
          <button
            className={`header-icon-btn ${rightPanelView.value === "members" ? "active" : ""}`}
            onClick={() => togglePanel("members")}
            title="Members"
          >
            <Icon name="Users" size={20} />
          </button>
        )}
        {isDM &&
          currentChannel.value?.name &&
          !SPECIAL_CHANNELS.has(currentChannel.value.name) &&
          (() => {
            const is1on1 =
              currentChannel.value?.icon ===
              avatarUrl(currentChannel.value?.display_name);
            return (
              <button
                className={`header-icon-btn ${rightPanelView.value === "members" ? "active" : ""}`}
                onClick={() => togglePanel("members")}
                title={is1on1 ? "User Profile" : "Members"}
              >
                <Icon name={is1on1 ? "User" : "Users"} size={20} />
              </button>
            );
          })()}
      </div>
    </div>
  );

  return (
    <>
      {renderMobileHeader()}
      {renderDesktopHeader()}
    </>
  );
}
