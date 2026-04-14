import { useEffect, useRef } from "preact/hooks";
import { userPopout, showAccountModal } from "../../lib/ui-signals";
import { UserProfileCard } from "../UserProfile";
import styles from "./UserPopout.module.css";

const isMobile = () => window.innerWidth <= 768;

export function UserPopout() {
  const popoutRef = useRef<HTMLDivElement>(null);
  const data = userPopout.value;

  useEffect(() => {
    if (showAccountModal.value) {
      userPopout.value = null;
    }
  }, [showAccountModal.value]);

  useEffect(() => {
    if (!data || !popoutRef.current) return;

    const el = popoutRef.current;

    const clamp = () => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const padding = 8;

      let left: number;
      let top: number;

      if (data.anchorEl) {
        const anchorRect = data.anchorEl.getBoundingClientRect();
        left = anchorRect.left;
        top = data.anchorRight ? anchorRect.top : anchorRect.bottom + 4;
      } else {
        left = data.x;
        top = data.y;
      }

      if (data.anchorRight) {
        left = left - rect.width - 8;
      }

      if (left + rect.width > window.innerWidth - padding) {
        left = window.innerWidth - rect.width - padding;
      }
      if (left < padding) left = padding;

      if (top + rect.height > window.innerHeight - padding) {
        top = window.innerHeight - rect.height - padding;
      }
      if (top < padding) top = padding;

      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.visibility = "visible";
    };

    clamp();

    const ro = new ResizeObserver(clamp);
    ro.observe(el);

    const handleClick = (e: MouseEvent) => {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        userPopout.value = null;
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") userPopout.value = null;
    };
    const handleScroll = (e: Event) => {
      // Ignore scrolls that happen inside the popout itself
      if (popoutRef.current && e.target instanceof Node && popoutRef.current.contains(e.target)) {
        return;
      }

      if (data.anchorEl) {
        // Close only if the anchor element has been removed from the DOM
        if (!document.contains(data.anchorEl)) {
          userPopout.value = null;
          return;
        }
        // Otherwise reposition the popout to follow the anchor
        clamp();
      } else {
        userPopout.value = null;
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
      window.addEventListener("scroll", handleScroll, true);
    }, 0);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [data]);

  if (!data) return null;

  return (
    <div
      ref={popoutRef}
      className={styles.userPopout}
      style={{
        position: "fixed",
        left: data.x,
        top: data.y,
        visibility: "hidden",
      }}
    >
      <UserProfileCard username={data.username} onClose={() => (userPopout.value = null)} compact />
    </div>
  );
}

export function openUserPopout(e: MouseEvent, username: string, anchorRight?: boolean) {
  e.stopPropagation();

  if (isMobile()) {
    showAccountModal.value = username;
    return;
  }

  const target = e.currentTarget as HTMLElement;
  if (!target) return;

  const rect = target.getBoundingClientRect();

  if (anchorRight) {
    userPopout.value = {
      username,
      x: rect.left,
      y: rect.top,
      anchorRight: true,
      anchorEl: target,
    };
  } else {
    userPopout.value = {
      username,
      x: rect.left,
      y: rect.bottom + 4,
      anchorRight: false,
      anchorEl: target,
    };
  }
}
