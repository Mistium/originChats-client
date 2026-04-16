import { h, ComponentChildren, RefObject } from "preact";
import { useState, useEffect, useRef, MutableRef } from "preact/hooks";
import { Icon } from "../Icon";
import { globalContextMenu, closeContextMenu } from "../../lib/ui-signals";
import styles from "./ContextMenu.module.css";

export interface ContextMenuItem {
  label: string;
  icon?: string;
  iconColor?: string;
  danger?: boolean;
  separator?: boolean;
  fn: (event?: Event) => void;
  children?: ContextMenuItem[];
}

const PAD = 6;

function useMenuPosition(
  menuRef: RefObject<HTMLDivElement>,
  options:
    | { mode: "root"; x: number; y: number }
    | { mode: "sub"; anchorEl: HTMLDivElement; preferLeft: boolean }
): { resolvedPreferLeft: MutableRef<boolean> } {
  const resolvedPreferLeft = useRef(false);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left: number;
    let top: number;

    if (options.mode === "root") {
      left = options.x;
      top = options.y;
      if (left + menu.offsetWidth > vw - PAD) {
        left = vw - menu.offsetWidth - PAD;
        resolvedPreferLeft.current = true;
      } else {
        resolvedPreferLeft.current = false;
      }
    } else {
      const anchor = options.anchorEl.getBoundingClientRect();
      top = anchor.top;
      if (!options.preferLeft && anchor.right + menu.offsetWidth + PAD <= vw) {
        left = anchor.right;
        resolvedPreferLeft.current = false;
      } else {
        left = anchor.left - menu.offsetWidth;
        resolvedPreferLeft.current = true;
      }
    }

    menu.style.left = `${Math.max(PAD, Math.min(left, vw - menu.offsetWidth - PAD))}px`;
    menu.style.top  = `${Math.max(PAD, Math.min(top,  vh - menu.offsetHeight - PAD))}px`;
    menu.style.visibility = "visible";
  }, [options.mode === "root" ? options.x : 0, options.mode === "root" ? options.y : 0]);

  return { resolvedPreferLeft };
}

interface MenuItemListProps {
  items: ContextMenuItem[];
  header?: ComponentChildren;
  itemEls: RefObject<(HTMLDivElement | null)[]>;
  onItemHover: (idx: number | null, el: HTMLDivElement | null) => void;
  onItemClick: (item: ContextMenuItem, e: MouseEvent) => void;
  onClose: () => void;
}

function MenuItemList({
  items,
  header,
  itemEls,
  onItemHover,
  onItemClick,
  onClose,
}: MenuItemListProps) {
  return (
    <>
      {header && <div className={styles.contextMenuHeader}>{header}</div>}
      {items.map((item, idx) => {
        if (item.separator) return <div key={idx} className={styles.contextMenuSeparator} />;
        const hasChildren = !!item.children?.length;
        return (
          <div
            key={idx}
            ref={(el) => { if (itemEls.current) itemEls.current[idx] = el; }}
            className={[
              styles.contextMenuItem,
              item.danger   ? styles.danger     : "",
              hasChildren   ? styles.hasSubmenu : "",
            ].filter(Boolean).join(" ")}
            onMouseEnter={() =>
              onItemHover(hasChildren ? idx : null, hasChildren && itemEls.current ? itemEls.current[idx] : null)
            }
            onClick={(e) => {
              if (!hasChildren) {
                e.stopPropagation();
                onItemClick(item, e);
              }
            }}
          >
            {item.icon && (
              <Icon
                name={item.icon as any}
                size={16}
                color={item.danger ? "var(--danger)" : item.iconColor}
                fill={item.danger || item.iconColor ? "currentColor" : undefined}
              />
            )}
            <span>{item.label}</span>
            {hasChildren && (
              <span className={styles.contextMenuArrow}>
                <Icon name="ChevronRight" size={14} />
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

interface SubMenuPanelProps {
  items: ContextMenuItem[];
  anchorEl: HTMLDivElement;
  onClose: () => void;
  preferLeft: boolean;
  onOpenChild: (idx: number | null, el: HTMLDivElement | null, preferLeft: boolean) => void;
  header?: ComponentChildren;
}

function SubMenuPanel({ items, anchorEl, onClose, preferLeft, onOpenChild, header }: SubMenuPanelProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemEls = useRef<(HTMLDivElement | null)[]>([]);
  const { resolvedPreferLeft } = useMenuPosition(menuRef, { mode: "sub", anchorEl, preferLeft });

  return (
    <div
      ref={menuRef}
      className={`${styles.contextMenu} ${styles.contextMenuSub}`}
      style="position:fixed;display:block;visibility:hidden"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItemList
        items={items}
        header={header}
        itemEls={itemEls}
        onItemHover={(idx, el) => onOpenChild(idx, el, resolvedPreferLeft.current)}
        onItemClick={(item, e) => { item.fn(e); onClose(); }}
        onClose={onClose}
      />
    </div>
  );
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  header?: ComponentChildren;
}

export function ContextMenu({ x, y, items, onClose, header }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemEls = useRef<(HTMLDivElement | null)[]>([]);
  const { resolvedPreferLeft } = useMenuPosition(menuRef, { mode: "root", x, y });

  // Each level of open submenu: { items, anchorEl, preferLeft }
  const [submenuStack, setSubmenuStack] = useState<
    Array<{
      items: ContextMenuItem[];
      anchorEl: HTMLDivElement;
      preferLeft: boolean;
    }>
  >([]);

  const openSubmenuAt = (
    depth: number,
    idx: number | null,
    anchorEl: HTMLDivElement | null,
    preferLeft: boolean
  ) => {
    if (idx === null || !anchorEl) {
      setSubmenuStack((s) => s.slice(0, depth));
      return;
    }
    const parentItems = depth === 0 ? items : submenuStack[depth - 1]?.items;
    const children = parentItems?.[idx]?.children;
    if (!children?.length) return;
    setSubmenuStack((s) => [...s.slice(0, depth), { items: children, anchorEl, preferLeft }]);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style="position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:var(--z-context-menu)">
      <div
        ref={menuRef}
        className={styles.contextMenu}
        style="position:fixed;display:block;visibility:hidden"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <MenuItemList
          items={items}
          header={header}
          itemEls={itemEls}
          onItemHover={(idx, el) =>
            openSubmenuAt(0, idx, el, resolvedPreferLeft.current)
          }
          onItemClick={(item, e) => { item.fn(e); onClose(); }}
          onClose={onClose}
        />
      </div>

      {submenuStack.map((level, depth) => (
        <SubMenuPanel
          key={depth}
          items={level.items}
          anchorEl={level.anchorEl}
          onClose={onClose}
          preferLeft={level.preferLeft}
          onOpenChild={(idx, el, preferLeft) => openSubmenuAt(depth + 1, idx, el, preferLeft)}
        />
      ))}
    </div>
  );
}

// ── GlobalContextMenu ─────────────────────────────────────────────────────────

export function GlobalContextMenu() {
  const state = globalContextMenu.value;
  if (!state) return null;
  return <ContextMenu x={state.x} y={state.y} items={state.items} onClose={closeContextMenu} />;
}