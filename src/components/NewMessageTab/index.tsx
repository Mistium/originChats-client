import { useState } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";
import { friends, currentUser } from "../../state";
import { Icon } from "../Icon";
import { UserAvatar } from "../UserAvatar";
import { useDisplayName } from "../../lib/hooks/useDisplayName";
import { openDMWith } from "../../lib/actions";
import { Header } from "../Header";

export function NewMessageTab() {
  const [search, setSearch] = useState("");

  useSignalEffect(() => {
    friends.value;
  });

  const friendsList = friends.value;
  const filtered = search.trim()
    ? friendsList.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : friendsList;

  const startDM = (username: string) => {
    openDMWith(username);
  };

  return (
    <div className="dm-home-container">
      <Header />
      <div className="new-message-content">
        <div className="new-message-search">
          <label>To:</label>
          <input
            type="text"
            placeholder="Search friends or enter a username..."
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            autoFocus
          />
        </div>
        <div className="new-message-list">
          {search.trim() && !friendsList.some((f) => f.toLowerCase() === search.toLowerCase()) && (
            <div
              className="new-message-item new-message-item-direct"
              onClick={() => startDM(search.trim())}
            >
              <div className="new-message-item-avatar">
                <Icon name="AtSign" size={20} />
              </div>
              <div className="new-message-item-info">
                <span className="new-message-item-name">{search.trim()}</span>
                <span className="new-message-item-hint">Send a direct message</span>
              </div>
              <Icon name="ArrowRight" size={16} />
            </div>
          )}
          {filtered.length > 0 ? (
            filtered.map((username) => (
              <NewMessageFriendItem
                key={username}
                username={username}
                onClick={() => startDM(username)}
              />
            ))
          ) : !search.trim() ? (
            <div className="dm-empty">
              <Icon name="Users" size={48} />
              <h3>Your Friends</h3>
              <p>Select a friend to start a conversation, or type a username above</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NewMessageFriendItem({ username, onClick }: { username: string; onClick: () => void }) {
  const displayName = useDisplayName(username);
  return (
    <div className="new-message-item" onClick={onClick}>
      <UserAvatar username={username} className="new-message-item-avatar" alt={displayName} />
      <div className="new-message-item-info">
        <span className="new-message-item-name">{displayName}</span>
        <span className="new-message-item-hint">Friend</span>
      </div>
      <Icon name="MessageCircle" size={16} />
    </div>
  );
}
