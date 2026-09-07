import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { colors } from './tokens';

const cssPath = fileURLToPath(new URL('./tokens.css', import.meta.url));
const css = readFileSync(cssPath, 'utf8');

/**
 * tokens.ts and tokens.css are two representations of one palette. Drift
 * between them is silent and produces a site that is subtly two designs, so
 * it fails the build instead.
 */
describe('token parity between tokens.ts and tokens.css', () => {
  for (const [name, value] of Object.entries(colors)) {
    it(`--${name} matches ${value}`, () => {
      const declaration = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i');
      const match = declaration.exec(css);
      expect(match, `--${name} is missing from tokens.css`).not.toBeNull();
      expect(match?.[1]?.toLowerCase()).toBe(value.toLowerCase());
    });
  }
});

describe('the no-pure-white, no-pure-black rule', () => {
  it('defines no #ffffff or #000000 token', () => {
    for (const value of Object.values(colors)) {
      expect(value.toLowerCase()).not.toBe('#ffffff');
      expect(value.toLowerCase()).not.toBe('#000000');
    }
  });

  it('uses no raw white or black in tokens.css', () => {
    // Strip comments first; the rule is explained in prose up top.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/#fff\b|#ffffff\b/i);
    expect(withoutComments).not.toMatch(/#000\b|#000000\b/i);
  });
});
