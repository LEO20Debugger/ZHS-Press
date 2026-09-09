'use client';

import { useEffect, useState } from 'react';
import { previewPosition, PREVIEW_WIDTH } from './preview-position';

export interface PreviewTarget {
  url: string;
  alt: string;
  title: string;
}

/**
 * Floating cover preview for the admin catalogue table.
 *
 * `position: fixed`, not absolute. The table sits inside an overflow-x-auto
 * wrapper so it can scroll on narrow screens, and an absolutely positioned
 * preview would be clipped by it. Fixed positioning escapes the scroll
 * container entirely.
 *
 * Pointer-events are off so the preview can never sit between the cursor and
 * the row it belongs to, which would make hover bounce between the two and
 * flicker.
 */
export function CoverPreview({
  target,
  x,
  y,
}: {
  target: PreviewTarget | null;
  x: number;
  y: number;
}) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  if (!target || viewport.width === 0) return null;

  const { left, top } = previewPosition(x, y, viewport);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 border border-rule bg-paper-raised p-2 shadow-[0_8px_28px_-8px_rgba(30,37,37,0.35)]"
      style={{ left, top, width: PREVIEW_WIDTH }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={target.url} alt="" className="h-auto w-full object-contain" />
      <p className="mt-2 truncate text-caption text-ink-muted">{target.title}</p>
    </div>
  );
}

/**
 * Whether this device actually hovers.
 *
 * A touch screen fires a synthetic mouseenter on tap, which would flash the
 * preview over whatever the user was trying to press. Asking about the pointer
 * capability is more reliable than guessing from viewport width.
 */
export function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    setHasHover(query.matches);

    const onChange = (event: MediaQueryListEvent) => setHasHover(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return hasHover;
}
