import type { UserJoin } from "@/msgTypes";
import { usersByServer } from "../../../state";
import { renderMembersSignal } from "../../ui-signals";

export function handleUserJoin(msg: UserJoin, sUrl: string): void {
  if (!usersByServer.value[sUrl]) {
    usersByServer.value = { ...usersByServer.value, [sUrl]: {} };
  }
  usersByServer.value = {
    ...usersByServer.value,
    [sUrl]: {
      ...usersByServer.value[sUrl],
      [msg.user.username?.toLowerCase()]: msg.user,
    },
  };
  renderMembersSignal.value++;
}
