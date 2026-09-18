'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconHome } from './nav-icons';
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

  /*
   * A mirror of the DOM's open state, not a replacement for it — `<details>`
   * still owns the toggle. This exists only because the backdrop is rendered
   * elsewhere in the document and has to be told when to appear.
   */
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    const el = ref.current;
    if (el?.open) el.open = false;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => setOpen(el.open);
    sync();
    el.addEventListener('toggle', sync);
    return () => el.removeEventListener('toggle', sync);
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
     * A second line of defence behind the backdrop, which handles the ordinary
     * case. This catches a press that reaches the page some other way — from
     * outside the viewport the backdrop covers, or before it has painted.
     *
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
        The backdrop: a transparent sheet over the page, catching the tap that
        dismisses the menu so it cannot also press whatever sits underneath.
        Without it, tapping "Explore the shop" through an open menu both closed
        the menu and navigated — one tap doing two things, only one of which
        was meant.

        Portalled to the body rather than rendered here, which is not a
        preference. The header carries `backdrop-blur`, and a backdrop-filter
        makes its element the containing block for every fixed-position
        descendant — so `fixed inset-0` written inside the header resolves to
        the header's own box, and the sheet covers the top 69 pixels of the
        page and nothing else. It looks right in the markup and blocks nothing.

        z-40 puts it under the header (z-50), so the Menu button stays live
        above it and closing by the button remains the native toggle, and over
        the page, which is all it needs to cover.

        Untinted. A dimmed sheet is the right call for a full-screen drawer,
        where it separates two layers of a page; for a small corner panel it
        would darken the whole screen to support five links, which reads as a
        far heavier moment than this is.
      */}
      {open
        ? createPortal(
            <div
              aria-hidden="true"
              onPointerDown={close}
              className="fixed inset-0 z-40 md:hidden"
            />,
            document.body,
          )
        : null}

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
        {/*
          Home, and only here.

          The desktop row does not need it: the lockup is large, obviously a
          logo, and sits beside the words it links to. On a phone that lockup is
          a 36px mark, and "tap the logo to go home" is a convention people know
          rather than something the page tells them — which is fine as the only
          route home right up until it is the only route home.

          First, out of the alphabetical run the rest of the menu follows. Home
          is the way back rather than a destination beside the others, and
          filing it between About and Shop would sort it into a list it is not
          really a member of.
        */}
        <li>
          <Link href="/" className="flex items-center gap-3 py-2 text-small">
            <IconHome className="text-ink-muted" />
            Home
          </Link>
        </li>

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
