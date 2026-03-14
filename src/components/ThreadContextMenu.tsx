import { useState } from "preact/hooks";
import { serverUrl, currentUserByServer, users } from "../state";
import { selectThread, deleteThread, getThread } from "../lib/actions";
import { wsSend } from "../lib/websocket";
import { updateThreadInChannel } from "../state";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { Icon } from "./Icon";
import type { Thread } from "../types";

export interface ThreadContextMenuProps {
  thread: Thread;
  x: number;
  y: number;
  onClose: () => void;
}

export function ThreadContextMenu({
  thread,
  x,
  y,
  onClose,
}: ThreadContextMenuProps) {
  const myUsername = currentUserByServer.value[serverUrl.value]?.username;
  const myRoles = users.value[myUsername?.toLowerCase() || ""]?.roles || [];
  const canManage =
    thread.created_by === myUsername ||
    myUsername === "admin" ||
    myRoles.includes("owner");

  const items: ContextMenuItem[] = [
    {
      label: "Open Thread",
      icon: "ExternalLink",
      fn: () => {
        selectThread(thread);
        getThread(thread.id);
        wsSend(
          { cmd: "thread_messages", thread_id: thread.id },
          serverUrl.value,
        );
      },
    },
    {
      label: "Copy Link",
      icon: "Link",
      fn: () => {
        const link = `${window.location.origin}/app/${serverUrl.value}/projects/${thread.id}`;
        navigator.clipboard.writeText(link);
      },
    },
  ];

  if (canManage) {
    items.push({ label: "", separator: true, fn: () => {} });

    items.push({
      label: thread.locked ? "Unlock Thread" : "Lock Thread",
      icon: thread.locked ? "Unlock" : "Lock",
      fn: () => {
        updateThreadInChannel(
          serverUrl.value,
          thread.parent_channel,
          thread.id,
          {
            locked: !thread.locked,
          },
        );
      },
    });

    items.push({
      label: thread.archived ? "Unarchive Thread" : "Archive Thread",
      icon: "Archive",
      fn: () => {
        updateThreadInChannel(
          serverUrl.value,
          thread.parent_channel,
          thread.id,
          {
            archived: !thread.archived,
          },
        );
      },
    });

    items.push({ label: "", separator: true, fn: () => {} });

    items.push({
      label: "Delete Thread",
      icon: "Trash2",
      danger: true,
      fn: () => {
        if (confirm("Are you sure you want to delete this thread?")) {
          deleteThread(thread.id);
        }
      },
    });
  }

  const header = (
    <>
      <div className="context-menu-icon">
        <Icon name="MessageSquare" size={20} />
      </div>
      <div className="context-menu-info">
        <span className="context-menu-name">{thread.name}</span>
        <span className="context-menu-status">by {thread.created_by}</span>
      </div>
    </>
  );

  return (
    <ContextMenu x={x} y={y} items={items} onClose={onClose} header={header} />
  );
}

export interface UseThreadContextMenuResult {
  showThreadMenu: (event: MouseEvent, thread: Thread) => void;
  closeThreadMenu: () => void;
  threadMenu: { thread: Thread; x: number; y: number } | null;
}

export function useThreadContextMenu(): UseThreadContextMenuResult {
  const [threadMenu, setThreadMenu] = useState<{
    thread: Thread;
    x: number;
    y: number;
  } | null>(null);

  const showThreadMenu = (event: MouseEvent, thread: Thread) => {
    event.preventDefault();
    event.stopPropagation();
    setThreadMenu({ thread, x: event.clientX, y: event.clientY });
  };

  const closeThreadMenu = () => setThreadMenu(null);

  return { showThreadMenu, closeThreadMenu, threadMenu };
}
