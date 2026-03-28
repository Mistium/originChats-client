import type { StatusGet } from "@/msgTypes";
import { usersByServer } from "../../../state";
import { statusState } from "../../state";
import { renderMembersSignal } from "../../ui-signals";

export function handleStatusGet(msg: StatusGet, sUrl: string): void {
  const username = msg.username?.toLowerCase();
  if (!username) return;
  if (usersByServer.value[sUrl]?.[username]) {
    usersByServer.value = {
      ...usersByServer.value,
      [sUrl]: {
        ...usersByServer.value[sUrl],
        [username]: {
          ...usersByServer.value[sUrl][username],
          status: msg.status,
        },
      },
    };
  }
  statusState.updateFromStatusGet(sUrl, msg.username, msg.status);
  renderMembersSignal.value++;
}
