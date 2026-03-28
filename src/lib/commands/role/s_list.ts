import type { RolesList } from "@/msgTypes";
import { rolesByServer } from "../../../state";

export function handleRolesList(msg: RolesList, sUrl: string): void {
  rolesByServer.value = { ...rolesByServer.value, [sUrl]: msg.roles };
}
