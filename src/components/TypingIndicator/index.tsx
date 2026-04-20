import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { Fragment } from "preact";
import {
  currentChannel,
  currentUser,
  serverUrl,
  usersByServer,
  typingUsersByServer,
} from "../../state";
import { getDisplayName } from "../../lib/hooks/useDisplayName";
import { UserAvatar } from "../UserAvatar";
import styles from "./TypingIndicator.module.css";

export interface TypingUser {
  username: string;
  displayName: string;
  color?: string | null;
}

export function useTypingIndicator() {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [prevTypingUsers, setPrevTypingUsers] = useState<TypingUser[]>([]);
  const [isTypingExiting, setIsTypingExiting] = useState(false);
  const typingExitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typingSubRef = useRef<{
    unsub: (() => void) | null;
    sUrl: string;
    chName: string;
    prevUsernames: string;
  }>({ unsub: null, sUrl: "", chName: "", prevUsernames: "" });

  const computeTypingUsers = useCallback((sUrl: string, chName: string) => {
    const serverTyping = typingUsersByServer.read(sUrl);
    if (!serverTyping || !serverTyping[chName]) {
      typingSubRef.current.prevUsernames = "";
      setTypingUsers([]);
      scheduleExpiryTimer();
      return;
    }
    const map = serverTyping[chName] as Map<string, number>;
    const now = Date.now();
    const myName = currentUser.value?.username;
    const typingList: TypingUser[] = [];
    const newMap = new Map<string, number>();
    let hasExpired = false;
    let nearestExpiry = Infinity;

    for (const [user, expiry] of map.entries()) {
      if (expiry < now) {
        hasExpired = true;
      } else {
        newMap.set(user, expiry);
        if (expiry < nearestExpiry) nearestExpiry = expiry;
        if (user !== myName) {
          const serverUser = usersByServer.read(sUrl)?.[user.toLowerCase()];
          typingList.push({
            username: user,
            displayName: getDisplayName(user),
            color: serverUser?.color,
          });
        }
      }
    }

    if (hasExpired) {
      typingUsersByServer.update(sUrl, (current) => ({
        ...current,
        [chName]: newMap,
      }));
    }

    const usernames = typingList.map((t) => t.username).join(",");
    if (usernames !== typingSubRef.current.prevUsernames) {
      typingSubRef.current.prevUsernames = usernames;
      setTypingUsers(typingList);
    }

    scheduleExpiryTimer(nearestExpiry);
  }, []);

  const scheduleExpiryTimer = useCallback(
    (nearestExpiry?: number) => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }

      const cur = typingSubRef.current;
      if (!cur.sUrl || !cur.chName) return;

      if (nearestExpiry === undefined) {
        const serverTyping = typingUsersByServer.read(cur.sUrl);
        const map = serverTyping?.[cur.chName] as Map<string, number> | undefined;
        if (map) {
          const now = Date.now();
          for (const [, expiry] of map.entries()) {
            if (expiry >= now && expiry < nearestExpiry!) {
              nearestExpiry = expiry;
            }
          }
        }
      }

      if (nearestExpiry !== undefined && nearestExpiry !== Infinity) {
        const delay = Math.max(0, nearestExpiry - Date.now());
        expiryTimerRef.current = setTimeout(() => {
          expiryTimerRef.current = null;
          computeTypingUsers(cur.sUrl, cur.chName);
        }, delay);
      }
    },
    [computeTypingUsers]
  );

  useEffect(() => {
    const sUrl = serverUrl.value;
    const chName = currentChannel.value?.name;

    if (typingSubRef.current.unsub) typingSubRef.current.unsub();
    typingSubRef.current.sUrl = sUrl || "";
    typingSubRef.current.chName = chName || "";
    typingSubRef.current.prevUsernames = "";

    if (sUrl && chName) {
      computeTypingUsers(sUrl, chName);
    } else {
      setTypingUsers([]);
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    }

    const typingSignal = typingUsersByServer.get(sUrl || "");
    const unsub = typingSignal.subscribe(() => {
      const cur = typingSubRef.current;
      if (!cur.sUrl || !cur.chName) return;

      const serverTyping = typingUsersByServer.read(cur.sUrl);
      if (!serverTyping) {
        if (cur.prevUsernames !== "") {
          cur.prevUsernames = "";
          setTypingUsers([]);
        }
        scheduleExpiryTimer();
        return;
      }

      const currentMap = serverTyping[cur.chName];
      if (!currentMap || (currentMap as Map<string, number>).size === 0) {
        if (cur.prevUsernames !== "") {
          cur.prevUsernames = "";
          setTypingUsers([]);
        }
        scheduleExpiryTimer();
        return;
      }

      computeTypingUsers(cur.sUrl, cur.chName);
    });
    typingSubRef.current.unsub = unsub;

    return () => {
      unsub();
      typingSubRef.current.unsub = null;
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, [serverUrl.value, currentChannel.value?.name, computeTypingUsers, scheduleExpiryTimer]);

  useEffect(() => {
    if (typingUsers.length === 0 && prevTypingUsers.length > 0) {
      setIsTypingExiting(true);
      if (typingExitTimeoutRef.current) {
        clearTimeout(typingExitTimeoutRef.current);
      }
      typingExitTimeoutRef.current = setTimeout(() => {
        setIsTypingExiting(false);
        setPrevTypingUsers([]);
      }, 150);
    } else if (typingUsers.length > 0) {
      setPrevTypingUsers(typingUsers);
      setIsTypingExiting(false);
      if (typingExitTimeoutRef.current) {
        clearTimeout(typingExitTimeoutRef.current);
      }
    }
  }, [typingUsers, prevTypingUsers.length]);

  useEffect(() => {
    return () => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
      }
      if (typingExitTimeoutRef.current) {
        clearTimeout(typingExitTimeoutRef.current);
      }
    };
  }, []);

  return { typingUsers, prevTypingUsers, isTypingExiting };
}

export function TypingIndicator({
  prevTypingUsers,
  isTypingExiting,
}: {
  typingUsers: TypingUser[];
  prevTypingUsers: TypingUser[];
  isTypingExiting: boolean;
}) {
  if (prevTypingUsers.length === 0) return null;

  return (
    <div className={styles.typingPill} data-exiting={isTypingExiting || undefined}>
      <div className={styles.typingPillAvatars}>
        {prevTypingUsers.slice(0, 3).map((u) => (
          <UserAvatar
            key={u.username}
            username={u.username}
            className={styles.typingPillAvatar}
            alt={u.displayName}
          />
        ))}
      </div>
      {prevTypingUsers.length <= 3 ? (
        <span className={styles.typingPillText}>
          {prevTypingUsers.map((u, i) => (
            <Fragment key={i}>
              {i > 0 && i === prevTypingUsers.length - 1 && prevTypingUsers.length === 2 && " and "}
              {i > 0 && i === prevTypingUsers.length - 1 && prevTypingUsers.length > 2 && ", and "}
              {i > 0 && i < prevTypingUsers.length - 1 && ", "}
              <span style={{ color: u.color ?? undefined }}>{u.displayName}</span>
            </Fragment>
          ))}
          {prevTypingUsers.length === 1 ? " is typing..." : " are typing..."}
        </span>
      ) : (
        <span className={styles.typingPillText}>
          {prevTypingUsers.slice(0, 2).map((u, i) => (
            <Fragment key={i}>
              {i > 0 && ", "}
              <span style={{ color: u.color ?? undefined }}>{u.displayName}</span>
            </Fragment>
          ))}
          {`, and ${prevTypingUsers.length - 2} others are typing...`}
        </span>
      )}
    </div>
  );
}
