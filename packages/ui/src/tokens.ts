/**
 * The token values as TypeScript, mirroring tokens.css.
 *
 * These exist so the API can validate accent colours (see contrast.ts) and so
 * Tailwind can build its theme from one source. tokens.css remains the runtime
 * source of truth for the browser; this file must not drift from it — the
 * token parity test in tokens.test.ts fails the build if it does.
 */

/* ---- Ground and ink -------------------------------------------------- */
export const PAPER = '#faf7f0';
export const PAPER_RAISED = '#fffefa';
export const PAPER_DEEP = '#f4eee0';
export const INK = '#1e2525';
export const INK_MUTED = '#565c5c';
export const RULE = '#e2dccc';

/* ---- Pigment accents ------------------------------------------------- */
export const TERRACOTTA = '#b13f2f';
export const CLAY = '#c97b5a';
export const BLUSH = '#f6dfd1';
export const SAND = '#e2d2ac';
export const INK_BLUE = '#2f4b7c';
export const MOSS = '#5a6b4e';
export const MARIGOLD = '#e0a02e';

export const colors = {
  paper: PAPER,
  'paper-raised': PAPER_RAISED,
  'paper-deep': PAPER_DEEP,
  ink: INK,
  'ink-muted': INK_MUTED,
  rule: RULE,
  terracotta: TERRACOTTA,
  clay: CLAY,
  blush: BLUSH,
  sand: SAND,
  'ink-blue': INK_BLUE,
  moss: MOSS,
  marigold: MARIGOLD,
} as const;

export type ColorToken = keyof typeof colors;

/**
 * The accents a per-title colour may be drawn from. Constraining admin to this
 * palette is what keeps thirty product pages looking like one press rather
 * than thirty separate websites.
 */
export const ACCENT_PALETTE = [
  TERRACOTTA,
  CLAY,
  SAND,
  INK_BLUE,
  MOSS,
  MARIGOLD,
  BLUSH,
] as const;

/** Light magazine reads as a distinct sub-brand without leaving the system. */
export const LIGHT_MAGAZINE_ACCENT = INK_BLUE;

export const fonts = {
  display: "'Fraunces', 'Iowan Old Style', Georgia, serif",
  ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  editorial: "'Newsreader', Georgia, 'Times New Roman', serif",
} as const;

export const layout = {
  shellMax: '1280px',
  measure: '68ch',
} as const;
