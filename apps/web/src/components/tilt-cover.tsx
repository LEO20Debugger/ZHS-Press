'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';

/**
 * A cover that tilts toward the cursor and lifts, as if picked up off a table.
 *
 * Only the large covers get this — the homepage hero and the product page —
 * where there is one object to look at. In a grid of cards, a dozen covers
 * leaning about would be noise.
 *
 * Mouse only. A touch has no hover, and tilting under a finger mid-scroll reads
 * as the page wobbling. Reduced motion is handled in CSS (`.tilt`), so the
 * handler can stay free of media queries: it still sets the variables, and the
 * stylesheet simply ignores them.
 *
 * The pointer position is written to CSS variables inside a frame callback,
 * never to React state — re-rendering on every mousemove would be wasted work
 * for a value only the compositor needs.
 */
export function TiltCover({
  children,
  className = '',
  /** Furthest the cover leans, in degrees. Past about 8 it reads as a gimmick. */
  maxTilt = 6,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return;
    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    // -0.5 at one edge to 0.5 at the other.
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      // The top edge comes forward when the cursor is near it, so rotateX is
      // the negated vertical position.
      node.style.setProperty('--tilt-x', `${(-y * maxTilt).toFixed(2)}deg`);
      node.style.setProperty('--tilt-y', `${(x * maxTilt).toFixed(2)}deg`);
      node.dataset.tilting = 'true';
    });
  }

  function onPointerLeave() {
    const node = ref.current;
    if (!node) return;

    cancelAnimationFrame(frame.current);
    node.style.removeProperty('--tilt-x');
    node.style.removeProperty('--tilt-y');
    delete node.dataset.tilting;
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`tilt ${className}`}
    >
      {children}
    </div>
  );
}
