'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { NAV } from './nav-items';

/**
 * The phone menu.
 *
 * Still a details/summary disclosure, so it opens and closes before any
 * JavaScript has run and is keyboard-operable without being told how. What is
 * added here is everything `<details>` does *not* do, all of which a menu on a
 * phone is expected to do:
 *
 * - **Tapping outside closes it.** A disclosure has no concept of outside; a
 *   menu does. Without this the only way out is to find the word Menu again,
 *   and a panel that will not dismiss reads as a stuck page.
 * - **Escape closes it**, returning focus to the button that opened it, which
 *   is where a keyboard user expects to be put back.
 * - **Following a link closes it.** Client-side navigation swaps the page under
 *   a header that never unmounts, so the menu would otherwise stay open over
 *   whatever you had just chosen.
 *
 * The open state stays in the DOM rather than in React. `<details>` owns it
 * natively, and mirroring it into state would mean two sources of truth that
 * drift the first time the browser toggles it without asking.
 */
export function MobileMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  const close = useCallback(() => {
    const el = ref.current;
    if (el?.open) el.open = false;
  }, []);

  /*
   * Belt and braces alongside the click handler below: that one covers a tap
   * on a link in this menu, this one covers arriving anywhere by any other
   * route — a redirect, the back button, a link elsewhere on the page.
   */
  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /*
     * pointerdown, not click: it fires at the moment of contact, so the menu is
     * already gone by the time the finger lifts. On click the panel lingers
     * for the length of the tap, which is exactly long enough to look broken.
     *
     * A press on the summary itself is inside the element, so it falls through
     * to the native toggle rather than being closed here and reopened there.
     */
    const onPointerDown = (event: PointerEvent) => {
      if (!el.open) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      el.open = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !el.open) return;
      el.open = false;
      el.querySelector('summary')?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className="relative md:hidden">
      <summary className="cursor-pointer list-none text-small [&::-webkit-details-marker]:hidden">
        Menu
      </summary>

      {/*
        Icons here, and not on the desktop row: a thumb picks a target by shape
        before it reads a word, and the menu is the one place on a phone where
        five destinations are weighed at once. They sit at a fixed width so the
        labels stay on a common left edge — ragged text beside mixed-width
        glyphs is the thing that makes a list of icons look assembled rather
        than drawn.

        The click handler sits on the list rather than on each link: one
        listener, and it still catches a tap on the link for the page you are
        already on, which changes no route and so fires no navigation.
      */}
      <ul
        onClick={close}
        className="absolute right-0 top-8 w-52 border border-rule bg-paper-raised p-4"
      >
        {NAV.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex items-center gap-3 py-2 text-small">
              <item.Icon className="text-ink-muted" />
              {item.label}
            </Link>

            {/*
              Indented under their parent, not flattened: the indent is what
              says these three are the Shop, rather than four unrelated
              destinations that happen to be adjacent. The rule carries the eye
              down the group.
            */}
            {'children' in item ? (
              <ul className="ml-[9px] border-l border-rule pl-4">
                {item.children.map((child) => (
                  <li key={child.href}>
                    <Link href={child.href} className="flex items-center gap-3 py-2 text-small">
                      <child.Icon size={16} className="text-ink-muted" />
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
