import type { UserRolesGet } from "@/msgTypes";
import { usersByServer } from "../../../state";

export function handleUserRolesGet(msg: UserRolesGet, sUrl: string): void {
  const username = msg.user?.toLowerCase();
  if (!username) return;
  const serverUsers = usersByServer.value[sUrl] || {};
  const user = serverUsers[username];
  if (user) {
    user.roles = msg.roles || [];
    if (msg.color) {
      user.color = msg.color;
    }
    usersByServer.value = {
      ...usersByServer.value,
      [sUrl]: { ...serverUsers },
    };
  }
}
