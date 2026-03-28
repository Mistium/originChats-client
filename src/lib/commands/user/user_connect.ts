import type { UserConnect } from "@/msgTypes";
import { usersByServer } from "../../../state";
import { renderMembersSignal } from "../../ui-signals";

export function handleUserConnect(msg: UserConnect, sUrl: string): void {
  if (!usersByServer.value[sUrl]) {
    usersByServer.value = { ...usersByServer.value, [sUrl]: {} };
  }
  const key = msg.user.username?.toLowerCase();
  if (key) {
    usersByServer.value = {
      ...usersByServer.value,
      [sUrl]: {
        ...usersByServer.value[sUrl],
        [key]: {
          ...usersByServer.value[sUrl][key],
          ...msg.user,
          status: { status: "online", text: "" },
        },
      },
    };
    renderMembersSignal.value++;
  }
}
