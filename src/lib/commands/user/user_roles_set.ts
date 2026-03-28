import type { UserRolesSet } from "@/msgTypes";
import { usersByServer, rolesByServer } from "../../../state";

export function handleUserRolesSet(msg: UserRolesSet, sUrl: string): void {
  const username = msg.user?.toLowerCase();
  if (!username) return;
  const serverUsers = usersByServer.value[sUrl] || {};
  const user = serverUsers[username];
  if (user) {
    user.roles = msg.roles || [];
    const roleColor = Object.values(rolesByServer.value[sUrl] || {}).find((r) =>
      user.roles?.includes(r.name),
    )?.color;
    if (roleColor) user.color = roleColor;
    usersByServer.value = {
      ...usersByServer.value,
      [sUrl]: { ...serverUsers },
    };
  }
}
