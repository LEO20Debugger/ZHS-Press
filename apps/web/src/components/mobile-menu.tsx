'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconClose, IconHome } from './nav-icons';
import { NAV } from './nav-items';

/**
 * How long the exit animation runs, matching --duration-fast in tokens.css.
 * Stated twice, in CSS and here, because a timeout cannot read a custom
 * property; if one moves the other has to follow.
 */
const EXIT_MS = 120;

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

/**
 * One row of the menu.
 *
 * `index` is the position in the panel counting every row, nested ones
 * included, and drives the stagger: the rows arrive top to bottom in the order
 * the eye reads them, regardless of how the list is nested to produce them.
 *
 * The current page is marked from the pathname alone, so a row carrying a query
 * — Stationery — never marks itself. Reading the query would mean
 * `useSearchParams`, which opts the whole header into client-side rendering
 * boundaries it does not otherwise need, to light one row on one page.
 */
function Row({
  href,
  label,
  Icon,
  size = 20,
  index,
  pathname,
}: {
  href: string;
  label: string;
  Icon: (props: { size?: number; className?: string }) => React.ReactElement;
  size?: number;
  index: number;
  pathname: string;
}) {
  const current = !href.includes('?') && pathname === href;

  return (
    <li className="menu-item" style={{ '--menu-index': index } as React.CSSProperties}>
      <Link
        href={href}
        aria-current={current ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-sm px-2 py-3 transition-colors duration-fast ${
          current ? 'bg-paper-deep' : 'hover:bg-paper'
        }`}
      >
        <Icon size={size} className={current ? 'text-ink' : 'text-ink-muted'} />
        {label}
      </Link>
    </li>
  );
}

export function MobileMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  /*
   * A mirror of the DOM's open state, not a replacement for it — `<details>`
   * still owns the toggle. This exists only because the backdrop is rendered
   * elsewhere in the document and has to be told when to appear.
   */
  const [open, setOpen] = useState(false);

  /*
   * True while the exit animation is playing. The panel is still open in the
   * DOM throughout — that is the whole point of it.
   */
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Closing in two steps, because `<details>` gives no say in the matter: the
   * moment `open` flips to false the content is gone, with nothing left to
   * animate. So the flag goes up, the exit plays against a panel that is still
   * open, and only then does the element actually close.
   *
   * Reduced motion skips straight to the end. The global rule would collapse
   * the animation to nothing anyway, but the timeout is JavaScript and knows
   * nothing about that rule — left in, it would hold a finished-looking panel
   * on screen for another 120ms.
   */
  const close = useCallback(() => {
    const el = ref.current;
    if (!el?.open) return;

    const instant =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (instant) {
      el.open = false;
      return;
    }

    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      el.open = false;
      setClosing(false);
    }, EXIT_MS);
  }, []);

  // A menu left mid-exit by a navigation must not fire its timer into a
  // component that is no longer here.
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /*
     * Clears `closing` whenever the element ends up closed by some other
     * route — the summary's own toggle, mainly, which flips it shut at once and
     * would otherwise leave the flag raised and the next opening pre-faded.
     */
    const sync = () => {
      setOpen(el.open);
      if (!el.open) {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setClosing(false);
      }
    };
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

  /*
   * A running position for the stagger, reset on every render so the rows are
   * numbered in the order they are emitted rather than accumulating.
   */
  let row = 0;
  const index = () => row++;

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
              className="menu-backdrop fixed inset-0 z-40 md:hidden"
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
      {/*
        Sized to the screen rather than to the longest label: a panel wide
        enough to reach both gutters gives every row a full-width tap target,
        so a thumb landing anywhere on the line hits the link. It stops short
        of the edges so it still reads as a panel over the page rather than a
        second page.

        The one shadow in the system lifts it off the page — warm, ink-tinted,
        and the reason this reads as a sheet laid over the site rather than a
        bordered box drawn on it.
      */}
      <div
        data-closing={closing || undefined}
        className="menu-panel absolute right-0 top-9 w-[min(20rem,calc(100vw-2.5rem))] overflow-hidden rounded-md border border-rule bg-paper-raised shadow-panel"
      >
        {/*
          A titled header, which is the difference between a dropdown and
          something considered: it names the panel, and it gives the close
          control a home at the top-right, where a thumb reaching for the
          corner expects to find it.

          The button is labelled rather than relying on the glyph — it is the
          only icon here with no text beside it.
        */}
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <span className="eyebrow">Menu</span>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="-mr-2 rounded-sm p-2 text-ink-muted transition-colors duration-fast hover:text-ink"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/*
          The click handler sits on the list rather than on each link: one
          listener, and it still catches a tap on the link for the page you are
          already on, which changes no route and so fires no navigation.
        */}
        <ul onClick={close} className="p-3">
          {/*
            Home, and only here.

            The desktop row does not need it: the lockup is large, obviously a
            logo, and sits beside the words it links to. On a phone that lockup
            is a 36px mark, and "tap the logo to go home" is a convention people
            know rather than something the page tells them — which is fine as
            the only route home right up until it is the only route home.

            First, out of the alphabetical run the rest of the menu follows.
            Home is the way back rather than a destination beside the others,
            and filing it between About and Shop would sort it into a list it is
            not really a member of.
          */}
          <Row href="/" label="Home" Icon={IconHome} index={index()} pathname={pathname} />

          {NAV.map((item) => (
            <Fragment key={item.href}>
              <Row
                href={item.href}
                label={item.label}
                Icon={item.Icon}
                index={index()}
                pathname={pathname}
              />

              {/*
                Indented under their parent, not flattened: the indent is what
                says these three are the Shop, rather than four unrelated
                destinations that happen to be adjacent. The rule carries the
                eye down the group.
              */}
              {'children' in item ? (
                <li>
                  <ul className="ml-[18px] border-l border-rule pl-[14px]">
                    {item.children.map((child) => (
                      <Row
                        key={child.href}
                        href={child.href}
                        label={child.label}
                        Icon={child.Icon}
                        size={18}
                        index={index()}
                        pathname={pathname}
                      />
                    ))}
                  </ul>
                </li>
              ) : null}
            </Fragment>
          ))}
        </ul>
      </div>
    </details>
  );
}
