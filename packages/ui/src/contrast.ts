/**
 * WCAG 2.2 contrast maths.
 *
 * This is not a lint-time nicety: it backs the per-title accent colour that
 * every book, issue and journal page is themed with. Warm off-white grounds
 * fail contrast easily, so an accent is validated on save in admin and
 * rejected if it cannot carry --ink as a background.
 */

import { INK, PAPER, PAPER_RAISED } from './tokens';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parses #rgb or #rrggbb. Returns null rather than throwing on bad input. */
export function parseHex(hex: string): Rgb | null {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) return null;

  let body = match[1] as string;
  if (body.length === 3) {
    body = body
      .split('')
      .map((c) => c + c)
      .join('');
  }

  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function linearise(channel8Bit: number): number {
  const c = channel8Bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/** WCAG contrast ratio, 1 to 21. Order of arguments does not matter. */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const rgbA = typeof a === 'string' ? parseHex(a) : a;
  const rgbB = typeof b === 'string' ? parseHex(b) : b;
  if (!rgbA || !rgbB) {
    throw new Error('contrastRatio received an unparseable colour');
  }

  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);

  return (lighter + 0.05) / (darker + 0.05);
}

export const WCAG_AA_NORMAL = 4.5;
/** 18.66px bold or 24px regular and above. */
export const WCAG_AA_LARGE = 3;
export const WCAG_AAA_NORMAL = 7;

export interface AccentValidation {
  valid: boolean;
  /** The best achievable ratio, using whichever foreground wins. */
  ratio: number;
  /** The text colour that must be paired with this accent. */
  foreground: string;
  required: number;
  reason?: string;
}

/**
 * An accent is used as a *background* — hero grounds, card tints, badges,
 * buttons — so what matters is whether text stays readable on top of it.
 *
 * The system has two possible foregrounds, and which one applies depends on
 * the accent: --ink works on the light pigments (blush, sand), while the
 * saturated ones need --paper-raised. Terracotta, for instance, manages only
 * 2.69:1 against ink but 5.75:1 against paper — so it is a perfectly good
 * button colour, just never with dark text on it.
 *
 * This picks the better of the two and reports it, so admin can store the
 * pairing rather than leaving each template to guess.
 */
export function validateAccent(
  accentHex: string,
  { minimumRatio = WCAG_AA_NORMAL, foregrounds = [INK, PAPER_RAISED] } = {},
): AccentValidation {
  const accent = parseHex(accentHex);
  if (!accent) {
    return {
      valid: false,
      ratio: 0,
      foreground: INK,
      required: minimumRatio,
      reason: `"${accentHex}" is not a valid hex colour.`,
    };
  }

  const scored = foregrounds
    .map((foreground) => ({ foreground, ratio: contrastRatio(accent, foreground) }))
    .sort((a, b) => b.ratio - a.ratio);

  const best = scored[0];
  if (!best) {
    throw new Error('validateAccent requires at least one candidate foreground');
  }

  if (best.ratio < minimumRatio) {
    return {
      valid: false,
      ratio: best.ratio,
      foreground: best.foreground,
      required: minimumRatio,
      reason:
        `Accent ${accentHex} reaches only ${best.ratio.toFixed(2)}:1 against the ` +
        `closest available text colour, below the ${minimumRatio}:1 needed. It sits in ` +
        `the mid-tone band where neither ink nor paper is readable on it — pick a ` +
        `clearly lighter or clearly darker pigment.`,
    };
  }

  return {
    valid: true,
    ratio: best.ratio,
    foreground: best.foreground,
    required: minimumRatio,
  };
}

/**
 * Derives the card/section tint from a title's accent by mixing it toward the
 * paper ground. Covers sit on this rather than on flat paper, which is what
 * makes each title's page feel made-for-it.
 *
 * @param weight 0 = paper, 1 = the full accent. Around 0.12 reads as a tint.
 */
export function deriveTint(accentHex: string, weight = 0.12): string {
  const accent = parseHex(accentHex);
  const paper = parseHex(PAPER);
  if (!accent || !paper) {
    throw new Error(`deriveTint received an unparseable colour: ${accentHex}`);
  }

  const clamped = Math.min(1, Math.max(0, weight));
  const mix = (a: number, p: number) => p + (a - p) * clamped;

  return toHex({
    r: mix(accent.r, paper.r),
    g: mix(accent.g, paper.g),
    b: mix(accent.b, paper.b),
  });
}
