import type {
  VoiceJoin,
  VoiceUserJoined,
  VoiceUserLeft,
  VoiceUserUpdated,
  VoiceLeave,
} from "@/msgTypes";
import type { VoiceUser, Channel } from "../../../types";
import { channelsByServer, currentUserByServer } from "../../../state";
import { voiceManager } from "../../../voice";
import { renderChannelsSignal } from "../../ui-signals";

function _vcUpdateChannelState(
  sUrl: string,
  channelName: string,
  updater: (prev: VoiceUser[]) => VoiceUser[]
): void {
  const chList = channelsByServer.value[sUrl];
  if (!chList) return;
  const idx = chList.findIndex((c: Channel) => c.name === channelName);
  if (idx === -1) return;
  const prev: VoiceUser[] = (chList[idx] as Channel).voice_state || [];
  const next = updater(prev);
  const updatedList = [...chList];
  updatedList[idx] = { ...updatedList[idx], voice_state: next };
  channelsByServer.value = { ...channelsByServer.value, [sUrl]: updatedList };
}

export function handleVoiceJoin(msg: VoiceJoin, sUrl: string): void {
  voiceManager.onJoined(msg.channel, (msg.participants || []) as any);
  const selfUsername = currentUserByServer.value[sUrl]?.username;
  _vcUpdateChannelState(sUrl, msg.channel, () => {
    const serverList = (msg.participants || []) as VoiceUser[];
    if (selfUsername && !serverList.find((u) => u.username === selfUsername)) {
      return [{ username: selfUsername, muted: voiceManager.isMuted }, ...serverList];
    }
    return serverList;
  });
  renderChannelsSignal.value++;
}

export function handleVoiceUserJoined(msg: VoiceUserJoined, sUrl: string): void {
  voiceManager.onUserJoined(msg.channel, msg.user as any);
  _vcUpdateChannelState(sUrl, msg.channel, (prev) => {
    if (prev.find((u) => u.username === msg.user?.username)) return prev;
    return [
      ...prev,
      {
        username: msg.user.username,
        muted: msg.user.muted ?? false,
        pfp: msg.user.pfp,
      },
    ];
  });
  renderChannelsSignal.value++;
}

export function handleVoiceUserLeft(msg: VoiceUserLeft, sUrl: string): void {
  voiceManager.onUserLeft(msg.channel, msg.username);
  _vcUpdateChannelState(sUrl, msg.channel, (prev) =>
    prev.filter((u) => u.username !== msg.username)
  );
  renderChannelsSignal.value++;
}

export function handleVoiceUserUpdated(msg: VoiceUserUpdated, sUrl: string): void {
  voiceManager.onUserUpdated(msg.channel, {
    ...msg.user,
    muted: msg.user.muted ?? false,
  } as any);
  _vcUpdateChannelState(sUrl, msg.channel, (prev) =>
    prev.map((u) => (u.username === msg.user?.username ? { ...u, muted: msg.user.muted } : u))
  );
  renderChannelsSignal.value++;
}

export function handleVoiceLeave(msg: VoiceLeave, sUrl: string): void {
  const myUsername = currentUserByServer.value[sUrl]?.username;
  if (myUsername && msg.channel) {
    _vcUpdateChannelState(sUrl, msg.channel, (prev) =>
      prev.filter((u) => u.username !== myUsername)
    );
    renderChannelsSignal.value++;
  }
}
