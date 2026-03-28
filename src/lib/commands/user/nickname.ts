import type { NicknameUpdate, NicknameRemove } from "@/msgTypes";
import { usersByServer } from "../../../state";
import { renderMembersSignal, renderMessagesSignal } from "../../ui-signals";

export function handleNicknameUpdate(msg: NicknameUpdate, sUrl: string): void {
  const uKey = msg.username?.toLowerCase();
  if (usersByServer.value[sUrl]?.[uKey]) {
    usersByServer.value[sUrl][uKey] = {
      ...usersByServer.value[sUrl][uKey],
      nickname: msg.nickname,
    };
    renderMembersSignal.value++;
    renderMessagesSignal.value++;
  }
}

export function handleNicknameRemove(msg: NicknameRemove, sUrl: string): void {
  const uKey = msg.username?.toLowerCase();
  if (usersByServer.value[sUrl]?.[uKey]) {
    usersByServer.value[sUrl][uKey] = {
      ...usersByServer.value[sUrl][uKey],
    };
    delete usersByServer.value[sUrl][uKey].nickname;
    renderMembersSignal.value++;
    renderMessagesSignal.value++;
  }
}
