import { currentUserByServer, serverUrl } from "../state";
import { showVoiceCallView } from "../lib/ui-signals";
import { voiceState, voiceManager } from "../voice";
import { Icon } from "./Icon";
import { avatarUrl } from "../utils";

interface VoiceCallViewProps {
  /**
   * When true the component renders in its embedded "split" mode inside the
   * message area.  The minimize button is replaced by a fullscreen-expand
   * button that sets showVoiceCallView = true to promote it to fullscreen.
   * When false (default) it renders as the fullscreen takeover view.
   */
  embedded?: boolean;
}

export function VoiceCallView({ embedded = false }: VoiceCallViewProps) {
  const state = voiceState.value;

  const myUsername =
    currentUserByServer.value[serverUrl.value]?.username || "You";

  const {
    currentChannel: channel,
    participants,
    isMuted,
    isSpeaking,
    isScreenSharing,
    isCameraOn,
    screenStreams,
    cameraStreams,
    localScreenStream,
    localCameraStream,
  } = state;

  const hasVideoStreams =
    Object.keys(screenStreams).length > 0 ||
    Object.keys(cameraStreams).length > 0 ||
    isScreenSharing ||
    isCameraOn;

  const selfPeerId = voiceManager.getMyPeerId();

  const rootClass = embedded
    ? "voice-call-view voice-call-view--embedded"
    : "voice-call-view";

  return (
    <div className={rootClass}>
      <div className="voice-call-header">
        <div className="voice-call-header-left">
          <Icon name="Mic" size={20} />
          <span className="voice-call-channel-name">{channel}</span>
          <span className="voice-call-participant-count">
            {participants.length} participant
            {participants.length !== 1 ? "s" : ""}
          </span>
        </div>
        {embedded ? (
          // In embedded mode: expand to fullscreen
          <button
            className="voice-call-minimize-btn"
            onClick={() => (showVoiceCallView.value = true)}
            title="Expand to fullscreen"
          >
            <Icon name="Maximize2" size={18} />
          </button>
        ) : (
          // In fullscreen mode: minimize back to embedded
          <button
            className="voice-call-minimize-btn"
            onClick={() => (showVoiceCallView.value = false)}
            title="Minimize"
          >
            <Icon name="Minimize2" size={18} />
          </button>
        )}
      </div>

      {hasVideoStreams && (
        <div className="voice-call-video-area">
          {/* Local screen share */}
          {isScreenSharing && localScreenStream && (
            <VideoTile
              stream={localScreenStream}
              label={`${myUsername} (Screen)`}
              muted
              isSelf
            />
          )}

          {/* Local camera */}
          {isCameraOn && localCameraStream && (
            <VideoTile
              stream={localCameraStream}
              label={`${myUsername} (Camera)`}
              muted
              isSelf
              isCamera
            />
          )}

          {/* Remote screen shares */}
          {Object.entries(screenStreams).map(([peerId, stream]) => {
            const p = participants.find((x) => x.peer_id === peerId);
            return (
              <VideoTile
                key={`screen-${peerId}`}
                stream={stream}
                label={`${p?.username || peerId} (Screen)`}
              />
            );
          })}

          {/* Remote cameras */}
          {Object.entries(cameraStreams).map(([peerId, stream]) => {
            const p = participants.find((x) => x.peer_id === peerId);
            return (
              <VideoTile
                key={`camera-${peerId}`}
                stream={stream}
                label={p?.username || peerId}
                isCamera
              />
            );
          })}
        </div>
      )}

      <div
        className={`voice-call-participants ${hasVideoStreams ? "compact" : ""}`}
      >
        {participants.map((p) => {
          const isSelf =
            (selfPeerId && p.peer_id === selfPeerId) ||
            p.username === myUsername;
          const speaking = isSelf ? isSpeaking : p.speaking;
          const muted = isSelf ? isMuted : p.muted;
          const displayName = isSelf ? `${myUsername} (You)` : p.username;

          return (
            <div
              key={p.peer_id}
              className={`voice-call-tile ${speaking ? "speaking" : ""} ${muted ? "muted" : ""}`}
            >
              <div className="voice-call-tile-avatar-wrap">
                <div
                  className={`voice-call-tile-speaking-ring ${speaking ? "active" : ""}`}
                />
                <img
                  src={avatarUrl(isSelf ? myUsername : p.username)}
                  alt={displayName}
                  className="voice-call-tile-avatar"
                />
              </div>
              <div className="voice-call-tile-name">{displayName}</div>
              <div className="voice-call-tile-status">
                <Icon name={muted ? "MicOff" : "Mic"} size={14} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="voice-call-controls">
        <button
          className={`voice-call-control-btn ${isMuted ? "muted" : ""}`}
          onClick={() => voiceManager.toggleMute()}
          title={isMuted ? "Unmute" : "Mute"}
        >
          <Icon name={isMuted ? "MicOff" : "Mic"} size={22} />
        </button>
        <button
          className={`voice-call-control-btn ${isCameraOn ? "active" : ""}`}
          onClick={() => voiceManager.toggleCamera()}
          title={isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
        >
          <Icon name={isCameraOn ? "VideoOff" : "Video"} size={22} />
        </button>
        <button
          className={`voice-call-control-btn ${isScreenSharing ? "active" : ""}`}
          onClick={() => voiceManager.toggleScreenShare()}
          title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
        >
          <Icon name={isScreenSharing ? "MonitorOff" : "Monitor"} size={22} />
        </button>
        <button
          className="voice-call-control-btn danger"
          onClick={() => voiceManager.leaveChannel()}
          title="Disconnect"
        >
          <Icon name="PhoneOff" size={22} />
        </button>
      </div>
    </div>
  );
}

// ── Video tile component ──────────────────────────────────────────────────────

function VideoTile({
  stream,
  label,
  muted,
  isSelf,
  isCamera,
}: {
  stream: MediaStream;
  label: string;
  muted?: boolean;
  isSelf?: boolean;
  isCamera?: boolean;
}) {
  const classes = [
    "voice-call-video-tile",
    isSelf && "voice-call-video-self",
    isCamera && "voice-call-video-camera",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <video
        ref={(el) => {
          if (el && el.srcObject !== stream) el.srcObject = stream;
        }}
        autoPlay
        muted={!!muted}
        playsInline
        className="voice-call-video-element"
      />
      <div className="voice-call-video-label">
        <span>{label}</span>
      </div>
    </div>
  );
}
