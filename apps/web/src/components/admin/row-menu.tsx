'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconMore } from './icons';

export interface RowMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Coloured as a destructive action. */
  danger?: boolean;
}

const MENU_WIDTH = 200;

/**
 * A row's actions behind a three-dot button.
 *
 * The menu is portalled to <body> and positioned with `fixed`, because the
 * tables it lives in scroll sideways on a phone, and an absolutely positioned
 * menu inside that scroller would be clipped by its edge. It opens below the
 * button, or above when there is no room below, and right-aligned to it.
 *
 * Behaves as a menu button: the trigger announces the menu, focus moves into
 * it on open, the arrow keys move between items, Escape and a click outside
 * close it and return focus to the trigger. Scrolling closes it rather than
 * leaving it floating away from the row it belongs to.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  // Placed after render, once the menu's real height is known.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!trigger || !menu) return;

    const gap = 6;
    const below = trigger.bottom + gap;
    const top =
      below + menu.height > window.innerHeight - 8 ? Math.max(8, trigger.top - gap - menu.height) : below;
    const left = Math.min(
      Math.max(8, trigger.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );
    setPosition({ top, left });
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    }
    const onScrollOrResize = () => close(false);

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'Tab') {
      // Tabbing away leaves the menu behind; it should not stay open.
      close(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title="Actions"
        className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:text-ink ${
          open ? 'bg-paper-deep text-ink' : ''
        }`}
      >
        <IconMore size={20} />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              onKeyDown={onMenuKeyDown}
              style={{
                position: 'fixed',
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                width: MENU_WIDTH,
              }}
              className="z-[60] rounded-md border border-rule bg-paper-raised p-1.5 shadow-panel"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close(false);
                    item.onSelect();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-sm px-3 py-2.5 text-left font-ui text-small transition-colors focus:outline-none focus-visible:bg-paper-deep ${
                    item.danger
                      ? 'text-danger hover:bg-paper-deep'
                      : 'text-ink hover:bg-paper-deep'
                  }`}
                >
                  {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
