import { describe, expect, it } from 'vitest';
import { contrastRatio, deriveTint, parseHex, relativeLuminance, validateAccent } from './contrast';
import { BLUSH, INK, INK_BLUE, PAPER, PAPER_RAISED, SAND, TERRACOTTA } from './tokens';

describe('parseHex', () => {
  it('parses six-digit hex with and without the hash', () => {
    expect(parseHex('#1e2525')).toEqual({ r: 30, g: 37, b: 37 });
    expect(parseHex('1e2525')).toEqual({ r: 30, g: 37, b: 37 });
  });

  it('expands three-digit shorthand', () => {
    expect(parseHex('#fa0')).toEqual({ r: 255, g: 170, b: 0 });
  });

  it('returns null on junk rather than throwing', () => {
    expect(parseHex('nope')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex('')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('anchors at the sRGB extremes', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('returns 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
  });

  it('is symmetric', () => {
    expect(contrastRatio(INK, PAPER)).toBeCloseTo(contrastRatio(PAPER, INK), 10);
  });

  it('confirms the documented ink-on-paper ratio', () => {
    // 14.58:1 — the measured value. The design docs quote this number; if it
    // drifts, the docs are wrong and need updating with it.
    expect(contrastRatio(INK, PAPER)).toBeCloseTo(14.58, 1);
  });

  it('confirms terracotta on paper clears AA but not AAA', () => {
    const ratio = contrastRatio(TERRACOTTA, PAPER);
    expect(ratio).toBeCloseTo(5.4, 1);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeLessThan(7);
  });
});

describe('validateAccent', () => {
  it('pairs light pigments with ink', () => {
    for (const accent of [BLUSH, SAND]) {
      const result = validateAccent(accent);
      expect(result.valid).toBe(true);
      expect(result.foreground).toBe(INK);
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('pairs saturated pigments with paper rather than rejecting them', () => {
    // Terracotta manages only 2.69:1 against ink but 5.75:1 against paper. It
    // is a good button colour — just never with dark text on it.
    for (const accent of [TERRACOTTA, INK_BLUE]) {
      const result = validateAccent(accent);
      expect(result.valid).toBe(true);
      expect(result.foreground).toBe(PAPER_RAISED);
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('rejects a mid-tone accent, where neither foreground is readable', () => {
    const result = validateAccent('#808080');
    expect(result.valid).toBe(false);
    expect(result.ratio).toBeLessThan(4.5);
    expect(result.reason).toMatch(/mid-tone band/);
  });

  it('rejects unparseable input with a usable message', () => {
    const result = validateAccent('rebeccapurple');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not a valid hex colour');
  });

  it('honours a relaxed threshold for large display text', () => {
    const midTone = '#808080';
    expect(validateAccent(midTone, { minimumRatio: 4.5 }).valid).toBe(false);
    expect(validateAccent(midTone, { minimumRatio: 3 }).valid).toBe(true);
  });

  it('can be restricted to a single foreground when a template demands one', () => {
    const result = validateAccent(TERRACOTTA, { foregrounds: [INK] });
    expect(result.valid).toBe(false);
    expect(result.foreground).toBe(INK);
  });
});

describe('deriveTint', () => {
  it('returns the paper ground at weight 0', () => {
    expect(deriveTint(TERRACOTTA, 0)).toBe(PAPER);
  });

  it('returns the accent itself at weight 1', () => {
    expect(deriveTint(TERRACOTTA, 1)).toBe(TERRACOTTA);
  });

  it('produces a tint light enough to carry ink at the default weight', () => {
    for (const accent of [TERRACOTTA, INK_BLUE, SAND]) {
      const tint = deriveTint(accent);
      expect(validateAccent(tint).valid).toBe(true);
    }
  });

  it('clamps out-of-range weights instead of producing invalid colour', () => {
    expect(deriveTint(TERRACOTTA, -5)).toBe(PAPER);
    expect(deriveTint(TERRACOTTA, 5)).toBe(TERRACOTTA);
  });
});
