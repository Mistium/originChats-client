import { useState, useEffect, useRef } from "preact/hooks";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const isSelf = username === currentUser.value?.username;
  const isFriend = friends.value.includes(username);
  const isBlocked = blockedUsers.value.includes(username);
  const hasPendingRequest = friendRequests.value.includes(username);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const padding = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let finalX = x;
    let finalY = y;

    if (finalX + menu.offsetWidth > vw - padding)
      finalX = vw - menu.offsetWidth - padding;
    if (finalY + menu.offsetHeight > vh - padding)
      finalY = vh - menu.offsetHeight - padding;
    if (finalX < padding) finalX = padding;
    if (finalY < padding) finalY = padding;

    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
    menu.style.visibility = "visible";
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const openProfile = () => {
    showAccountModal.value = username;
    onClose();
  };

  const sendMessage = async () => {
    await openDMWith(username);
    onClose();
  };

  const handleSendFriendRequest = () => {
    sendFriendRequest(username);
    onClose();
  };

  const handleRemoveFriend = () => {
    removeFriend(username);
    onClose();
  };

  const handleAcceptFriend = () => {
    acceptFriend(username);
    onClose();
  };

  const handleDenyFriend = () => {
    denyFriend(username);
    onClose();
  };

  const handleBlockUser = () => {
    blockUser(username);
    onClose();
  };

  const handleUnblockUser = () => {
    unblockUser(username);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="user-context-menu"
      style={{ position: "fixed", visibility: "hidden" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="user-context-header" onClick={openProfile}>
        <img
          src={avatarUrl(username)}
          className="user-context-avatar"
          alt={username}
        />
        <div className="user-context-info">
          <span className="user-context-name">{username}</span>
          <span className="user-context-status">
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
      </div>

      <div className="user-context-separator" />

      <div className="user-context-item" onClick={openProfile}>
        <Icon name="User" size={16} />
        <span>View Profile</span>
      </div>

      <div
        className="user-context-item"
        onClick={() => {
          reloadAvatar(username);
          onClose();
        }}
      >
        <Icon name="RefreshCw" size={16} />
        <span>Reload Avatar</span>
      </div>

      {!isSelf && (
        <>
          <div className="user-context-item" onClick={sendMessage}>
            <Icon name="MessageCircle" size={16} />
            <span>Message</span>
          </div>

          <div className="user-context-separator" />

          {hasPendingRequest ? (
            <>
              <div className="user-context-item" onClick={handleAcceptFriend}>
                <Icon name="Check" size={16} />
                <span>Accept Friend Request</span>
              </div>
              <div
                className="user-context-item danger"
                onClick={handleDenyFriend}
              >
                <Icon name="X" size={16} />
                <span>Deny Friend Request</span>
              </div>
            </>
          ) : isFriend ? (
            <div
              className="user-context-item danger"
              onClick={handleRemoveFriend}
            >
              <Icon name="UserX" size={16} />
              <span>Remove Friend</span>
            </div>
          ) : !isBlocked ? (
            <div
              className="user-context-item"
              onClick={handleSendFriendRequest}
            >
              <Icon name="UserPlus" size={16} />
              <span>Send Friend Request</span>
            </div>
          ) : null}

          {isBlocked ? (
            <div className="user-context-item" onClick={handleUnblockUser}>
              <Icon name="ShieldOff" size={16} />
              <span>Unblock</span>
            </div>
          ) : (
            <div className="user-context-item danger" onClick={handleBlockUser}>
              <Icon name="ShieldOff" size={16} />
              <span>Block</span>
            </div>
          )}
        </>
      )}
    </div>
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
