import { useState } from "preact/hooks";
import { friends, friendRequests, blockedUsers, currentUser } from "../state";
import {
  openDMWith,
  sendFriendRequest,
  removeFriend,
  acceptFriend,
  denyFriend,
  blockUser,
  unblockUser,
} from "../lib/actions";
import { showAccountModal } from "../lib/ui-signals";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { Icon } from "./Icon";
import { avatarUrl, reloadAvatar } from "../utils";

export interface UserContextMenuProps {
  username: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function UserContextMenu({
  username,
  x,
  y,
  onClose,
}: UserContextMenuProps) {
  const isSelf = username === currentUser.value?.username;
  const isFriend = friends.value.includes(username);
  const isBlocked = blockedUsers.value.includes(username);
  const hasPendingRequest = friendRequests.value.includes(username);

  const items: ContextMenuItem[] = [
    {
      label: "View Profile",
      icon: "User",
      fn: () => {
        showAccountModal.value = username;
      },
    },
    {
      label: "Reload Avatar",
      icon: "RefreshCw",
      fn: () => {
        reloadAvatar(username);
      },
    },
  ];

  if (!isSelf) {
    items.push({
      label: "Message",
      icon: "MessageCircle",
      fn: () => openDMWith(username),
    });

    items.push({ label: "", separator: true, fn: () => {} });

    if (hasPendingRequest) {
      items.push(
        {
          label: "Accept Friend Request",
          icon: "Check",
          fn: () => acceptFriend(username),
        },
        {
          label: "Deny Friend Request",
          icon: "X",
          danger: true,
          fn: () => denyFriend(username),
        },
      );
    } else if (isFriend) {
      items.push({
        label: "Remove Friend",
        icon: "UserX",
        danger: true,
        fn: () => removeFriend(username),
      });
    } else if (!isBlocked) {
      items.push({
        label: "Send Friend Request",
        icon: "UserPlus",
        fn: () => sendFriendRequest(username),
      });
    }

    if (isBlocked) {
      items.push({
        label: "Unblock",
        icon: "ShieldOff",
        fn: () => unblockUser(username),
      });
    } else {
      items.push({
        label: "Block",
        icon: "ShieldOff",
        danger: true,
        fn: () => blockUser(username),
      });
    }
  }

  const header = (
    <>
      <img
        src={avatarUrl(username)}
        className="context-menu-avatar"
        alt={username}
      />
      <div className="context-menu-info">
        <span className="context-menu-name">{username}</span>
        <span className="context-menu-status">
          {isSelf
            ? "You"
            : isFriend
              ? "Friend"
              : hasPendingRequest
                ? "Pending Request"
                : isBlocked
                  ? "Blocked"
                  : ""}
        </span>
      </div>
    </>
  );

  return (
    <ContextMenu x={x} y={y} items={items} onClose={onClose} header={header} />
  );
}

export interface UseUserContextMenuResult {
  showUserMenu: (event: MouseEvent, username: string) => void;
  closeUserMenu: () => void;
  userMenu: { username: string; x: number; y: number } | null;
}

export function useUserContextMenu(): UseUserContextMenuResult {
  const [userMenu, setUserMenu] = useState<{
    username: string;
    x: number;
    y: number;
  } | null>(null);

  const showUserMenu = (event: MouseEvent, username: string) => {
    event.preventDefault();
    event.stopPropagation();
    setUserMenu({ username, x: event.clientX, y: event.clientY });
  };

  const closeUserMenu = () => setUserMenu(null);

  return { showUserMenu, closeUserMenu, userMenu };
}
