import type { UserDisconnect, UserLeave } from "@/msgTypes";
import { usersByServer } from "../../../state";
import { renderMembersSignal } from "../../ui-signals";

export function handleUserDisconnect(msg: UserDisconnect, sUrl: string): void {
  const uKey = msg.username.toLowerCase();
  if (usersByServer.value[sUrl]?.[uKey]) {
    usersByServer.value = {
      ...usersByServer.value,
      [sUrl]: {
        ...usersByServer.value[sUrl],
        [uKey]: {
          ...usersByServer.value[sUrl][uKey],
          status: { status: "offline", text: "" },
        },
      },
    };
    renderMembersSignal.value++;
  }
}

export function handleUserLeave(msg: UserLeave, sUrl: string): void {
  if (usersByServer.value[sUrl]?.[msg.username?.toLowerCase()]) {
    const updated = { ...usersByServer.value[sUrl] };
    delete updated[msg.username.toLowerCase()];
    usersByServer.value = { ...usersByServer.value, [sUrl]: updated };
    renderMembersSignal.value++;
  }
}
