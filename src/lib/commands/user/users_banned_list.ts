import type { UsersBannedList } from "@/msgTypes";
import { bannedUsersByServer } from "../../ui-signals";

export function handleUsersBannedList(
  msg: UsersBannedList,
  sUrl: string,
): void {
  bannedUsersByServer.value = {
    ...bannedUsersByServer.value,
    [sUrl]: msg.users || [],
  };
}
