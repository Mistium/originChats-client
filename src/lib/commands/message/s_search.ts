import type { MessagesSearch } from "@/msgTypes";
import { searchResults, searchLoading } from "../../ui-signals";

export function handleMessagesSearch(msg: MessagesSearch): void {
  searchResults.value = msg.results || [];
  searchLoading.value = false;
}
