import type { UsersList } from "@/msgTypes";
import type { ServerUser } from "../../../types";
import { usersByServer } from "../../../state";
import { renderMembersSignal } from "../../ui-signals";

export function handleUsersList(msg: UsersList, sUrl: string): void {
  const existing = usersByServer.value[sUrl] || {};
  const next: Record<string, (typeof existing)[string]> = {};
  for (const user of msg.users) {
    const key = user.username?.toLowerCase();
    if (!key) continue;
    const statusObj = user.status;
    const normalizedUser: ServerUser = {
      ...existing[key],
      ...user,
      status:
        typeof statusObj === "object"
          ? statusObj
          : {
              status: (statusObj || "offline") as
                | "online"
                | "idle"
                | "dnd"
                | "offline",
              text: "",
            },
    };
    next[key] = normalizedUser;
  }
  usersByServer.value = { ...usersByServer.value, [sUrl]: next };
  renderMembersSignal.value++;
}
