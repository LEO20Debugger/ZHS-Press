export interface Viewport {
  width: number;
  height: number;
}

export const PREVIEW_WIDTH = 200;
export const PREVIEW_HEIGHT = 267;
export const CURSOR_GAP = 20;

/**
 * Places the floating cover preview relative to the cursor.
 *
 * Pure, and separate from the component, because the interesting behaviour is
 * all at the viewport edges — where a preview that runs off screen is both
 * useless and hard to notice in casual testing.
 *
 * Horizontally it flips to the other side of the cursor. Vertically it clamps
 * instead: a card that jumps above the cursor near the fold is more
 * disorienting than one that simply stops following.
 */
export function previewPosition(
  x: number,
  y: number,
  viewport: Viewport,
): { left: number; top: number } {
  const overflowsRight = x + CURSOR_GAP + PREVIEW_WIDTH > viewport.width;
  const left = overflowsRight ? x - CURSOR_GAP - PREVIEW_WIDTH : x + CURSOR_GAP;

  const lowestTop = Math.max(CURSOR_GAP, viewport.height - PREVIEW_HEIGHT - CURSOR_GAP);
  const top = Math.min(Math.max(CURSOR_GAP, y - PREVIEW_HEIGHT / 2), lowestTop);

  return {
    // A flip near the left edge could still push it off screen on a narrow
    // window; never allow a negative offset.
    left: Math.max(CURSOR_GAP, left),
    top,
  };
}
