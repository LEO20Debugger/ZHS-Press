'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long the exit animation runs, matching --duration-fast in tokens.css.
 * Stated twice, in CSS and here, because a timeout cannot read a custom
 * property; if one moves the other has to follow.
 */
const EXIT_MS = 120;

/**
 * Everything a `<details>` needs to behave like a menu.
 *
 * The element stays the source of truth — it opens and closes natively, before
 * hydration and from the keyboard, and nothing here replaces that. What this
 * adds is the handful of things a disclosure has no opinion about but a menu is
 * expected to do: dismiss on a tap outside, dismiss on Escape, dismiss when the
 * page changes underneath it, and survive long enough to animate on the way
 * out.
 *
 * Shared by the phone menu and the shop's filters because the fiddly parts —
 * the deferred close in particular — are exactly the parts that are easy to get
 * subtly wrong in a second copy.
 */
export function useDisclosure() {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  /** Mirrors the DOM, for anything that has to render outside the element. */
  const [open, setOpen] = useState(false);

  /** True while the exit animation plays, with the element still open. */
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Closing in two steps, because `<details>` gives no say in the matter: the
   * moment `open` flips to false the content is gone, with nothing left to
   * animate. So the flag goes up, the exit plays against a panel that is still
   * open, and only then does the element actually close.
   *
   * Reduced motion skips straight to the end. The global rule would collapse
   * the animation to nothing anyway, but this timeout is JavaScript and knows
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

  // A panel left mid-exit by a navigation must not fire its timer into a
  // component that is no longer here.
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /*
     * Clears `closing` whenever the element ends up closed by some other route
     * — the summary's own toggle, mainly, which flips it shut at once and would
     * otherwise leave the flag raised and the next opening pre-faded.
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
   * Belt and braces alongside a click handler on the panel itself: that covers
   * a tap on a link inside, this covers arriving anywhere by any other route —
   * a redirect, the back button, a link elsewhere on the page.
   */
  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /*
     * pointerdown, not click: it fires at the moment of contact, so the panel
     * is already going by the time the finger lifts. On click it lingers for
     * the length of the tap, which is exactly long enough to look broken.
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

  return { ref, open, closing, close };
}
