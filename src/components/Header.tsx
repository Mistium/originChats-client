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
} from "../state";
import { Icon } from "./Icon";
import {
  mobileSidebarOpen,
  mobilePanelOpen,
  rightPanelView,
  showVoiceCallView,
} from "../lib/ui-signals";

import { CallButton } from "./buttons/CallButton";

export function Header() {
  const [, forceUpdate] = useReducer((n) => n + 1, 0);
  useSignalEffect(() => {
    // Subscribe to every signal read inside this component so it re-renders
    // whenever the current channel, voice state, ping counts, or server capabilities change.
    currentChannel.value;
    serverPingsByServer.value;
    unreadByChannel.value;
    serverUrl.value;
    showVoiceCallView.value;
    serverCapabilities.value;
    forceUpdate(undefined);
  });
  const isDM = serverUrl.value === DM_SERVER_URL;
  const ch = currentChannel.value;
  // Call button only shown for channels explicitly typed as "chat"
  const isChatChannel = ch !== null && ch.type === "chat";

  // Server capability flags
  const caps = serverCapabilities.value;
  const canPin =
    caps.includes("message_pin") && caps.includes("messages_pinned");
  const canSearch = caps.includes("messages_search");
  const canInbox = caps.includes("pings_get");

  // Sum pings across all servers + DM unreads
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
    // close the right panel when opening nav
    if (mobileSidebarOpen.value) mobilePanelOpen.value = false;
  };

  const toggleRightPanel = (
    panel: "members" | "pinned" | "search" | "inbox",
  ) => {
    if (rightPanelView.value === panel && mobilePanelOpen.value) {
      mobilePanelOpen.value = false;
    } else {
      rightPanelView.value = panel;
      mobilePanelOpen.value = true;
      // close nav when opening right panel
      mobileSidebarOpen.value = false;
    }
  };

  return (
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
        <button
          className={`header-btn ${rightPanelView.value === "search" && mobilePanelOpen.value ? "active" : ""}`}
          onClick={() => toggleRightPanel("search")}
          aria-label="Search"
        >
          <Icon name="Search" />
        </button>
        <button
          className={`header-btn ${rightPanelView.value === "pinned" && mobilePanelOpen.value ? "active" : ""}`}
          onClick={() => toggleRightPanel("pinned")}
          aria-label="Pinned messages"
        >
          <Icon name="Pin" />
        </button>
        <button
          className={`header-btn ${rightPanelView.value === "inbox" && mobilePanelOpen.value ? "active" : ""}`}
          onClick={() => toggleRightPanel("inbox")}
          aria-label="Inbox"
        >
          <Icon name="Bell" />
        </button>
        {!isDM && (
          <button
            className={`header-btn ${rightPanelView.value === "members" && mobilePanelOpen.value ? "active" : ""}`}
            onClick={() => toggleRightPanel("members")}
            aria-label="Members"
          >
            <Icon name="Users" />
          </button>
        )}
      </div>
    </div>
  );
}
