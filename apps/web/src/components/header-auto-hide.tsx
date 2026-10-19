'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Below this, the header always shows: the top of a page is where it belongs. */
const ALWAYS_SHOWN_ABOVE = 120;

/**
 * Pixels of travel before a direction counts. Smaller, and a trackpad's
 * inertia or a finger resting on glass flickers the header in and out.
 */
const THRESHOLD = 8;

/**
 * Hides the site header while the reader scrolls down, and brings it back the
 * moment they scroll up.
 *
 * On a long page the header is a band of screen spent on links nobody is
 * reaching for mid-read — and on the shop it stacked above the sticky filter
 * bar, giving a fifth of a phone screen to chrome. Scrolling up is the gesture
 * people already make when they want to go somewhere else, so that is what
 * summons it.
 *
 * It only sets `data-header-hidden` on <html>; the movement is CSS (see
 * `[data-site-header]` and `.sticky-under-header` in globals.css), so nothing
 * here re-renders on scroll.
 *
 * Never hidden while the phone menu is open, or while focus is inside the
 * header — a keyboard user tabbing into it must be able to see where they are.
 */
export function HeaderAutoHide() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>('[data-site-header]');
    if (!header) return;

    const setHidden = (hidden: boolean) => {
      if (hidden) root.dataset.headerHidden = 'true';
      else delete root.dataset.headerHidden;
    };

    let lastY = window.scrollY;
    let frame = 0;

    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;

        const pinned =
          y < ALWAYS_SHOWN_ABOVE ||
          header!.querySelector('details[open]') !== null ||
          header!.contains(document.activeElement);

        if (pinned) {
          setHidden(false);
          lastY = y;
          return;
        }

        if (Math.abs(delta) < THRESHOLD) return;
        setHidden(delta > 0);
        lastY = y;
      });
    }

    const show = () => setHidden(false);

    window.addEventListener('scroll', onScroll, { passive: true });
    header.addEventListener('focusin', show);
    // Opening the phone menu always reveals the header it lives in.
    header.addEventListener('toggle', show, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      header.removeEventListener('focusin', show);
      header.removeEventListener('toggle', show, true);
      setHidden(false);
    };
  }, []);

  // A new page starts with the header showing, wherever the last one left it.
  useEffect(() => {
    delete document.documentElement.dataset.headerHidden;
  }, [pathname]);

  return null;
}
