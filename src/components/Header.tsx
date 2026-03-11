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
  currentUserByServer,
} from "../state";
import { Icon } from "./Icon";
import {
  mobileSidebarOpen,
  mobilePanelOpen,
  rightPanelView,
  showVoiceCallView,
} from "../lib/ui-signals";
import { voiceManager, voiceState } from "../voice";

export function Header() {
  const [, forceUpdate] = useReducer((n) => n + 1, 0);
  useSignalEffect(() => {
    // Subscribe to every signal read inside this component so it re-renders
    // whenever the current channel, voice state, or ping counts change.
    currentChannel.value;
    voiceState.value;
    serverPingsByServer.value;
    unreadByChannel.value;
    serverUrl.value;
    currentUserByServer.value;
    showVoiceCallView.value;
    forceUpdate(undefined);
  });
  const isDM = serverUrl.value === DM_SERVER_URL;
  const ch = currentChannel.value;
  // Call button only shown for channels explicitly typed as "chat"
  const isChatChannel = ch !== null && ch.type === "chat";
  const voice = voiceState.value;
  const myUsername = currentUserByServer.value[serverUrl.value]?.username;

  // True when we're actively in a call on this specific chat channel
  const inCallHere = isChatChannel && voice.currentChannel === ch?.name;

  const handleCallBtn = () => {
    if (!ch) return;
    if (inCallHere) {
      voiceManager.leaveChannel();
    } else {
      voiceManager.joinChannel(ch.name, myUsername, ch.type);
    }
  };

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
        {isChatChannel && (
          <button
            className={`header-btn ${inCallHere ? "active" : ""}`}
            onClick={handleCallBtn}
            aria-label={inCallHere ? "Open call" : "Start call"}
            title={inCallHere ? "Open call" : "Start call"}
          >
            <Icon name={inCallHere ? "PhoneCall" : "Phone"} />
          </button>
        )}
        <button
          className={`header-btn ${rightPanelView.value === "search" && mobilePanelOpen.value ? "active" : ""}`}
          onClick={() => toggleRightPanel("search")}
          aria-label="Search"
        >
          <Icon name="Pin" />
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
