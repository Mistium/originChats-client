import type { UsersOnline } from "@/msgTypes";
import { usersByServer } from "../../../state";
import { renderMembersSignal } from "../../ui-signals";

export function handleUsersOnline(msg: UsersOnline, sUrl: string): void {
  if (!usersByServer.value[sUrl])
    usersByServer.value = { ...usersByServer.value, [sUrl]: {} };
  const onlineUsernames = new Set<string>();
  for (const user of msg.users) {
    const key = user.username?.toLowerCase();
    if (!key) continue;
    onlineUsernames.add(key);
    const statusObj = user.status;
    const newStatus =
      typeof statusObj === "object"
        ? statusObj
        : { status: "online" as const, text: "" };
    if (usersByServer.value[sUrl]?.[key]) {
      usersByServer.value[sUrl][key].status = newStatus;
    }
  }
  for (const key of Object.keys(usersByServer.value[sUrl] || {})) {
    if (!onlineUsernames.has(key)) {
      usersByServer.value[sUrl][key].status = {
        status: "offline",
        text: "",
      };
    }
  }
  renderMembersSignal.value++;
}
