import type { AttachmentDeleted } from "@/msgTypes";
import { showBanner } from "../../ui-signals";

export function handleAttachmentDeleted(msg: AttachmentDeleted): void {
  if (msg.deleted) {
    showBanner({
      kind: "info",
      message: "Attachment deleted successfully",
      autoDismissMs: 3000,
    });
  }
}
