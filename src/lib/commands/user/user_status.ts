import type { UserStatus } from "@/msgTypes";
import { usersByServer } from "../../../state";
import { renderMembersSignal } from "../../ui-signals";

export function handleUserStatus(msg: UserStatus, sUrl: string): void {
  const uKey = msg.username?.toLowerCase();
  if (usersByServer.value[sUrl]?.[uKey]) {
    usersByServer.value[sUrl][uKey] = {
      ...usersByServer.value[sUrl][uKey],
      status: msg.status,
    };
    renderMembersSignal.value++;
  }
}
