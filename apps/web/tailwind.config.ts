import type { Config } from 'tailwindcss';

/**
 * Tailwind reads the design tokens rather than defining its own palette.
 *
 * Every colour here points at a CSS custom property from @zhs/ui/tokens.css, so
 * there is exactly one place a colour is defined. It also means a per-title
 * accent can be set as an inline custom property on a wrapper and every
 * `bg-accent` / `text-accent-fg` inside it re-themes with no extra classes.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    // Replaced wholesale, not extended: Tailwind's default palette is exactly
    // the generic look this design is trying to avoid, and leaving it in place
    // makes `bg-gray-100` available to anyone in a hurry.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',

      paper: 'var(--paper)',
      'paper-raised': 'var(--paper-raised)',
      'paper-deep': 'var(--paper-deep)',
      ink: 'var(--ink)',
      'ink-muted': 'var(--ink-muted)',
      rule: 'var(--rule)',

      terracotta: 'var(--terracotta)',
      clay: 'var(--clay)',
      blush: 'var(--blush)',
      sand: 'var(--sand)',
      'ink-blue': 'var(--ink-blue)',
      moss: 'var(--moss)',
      marigold: 'var(--marigold)',

      /** Per-title accent, set as inline custom properties on a wrapper. */
      accent: 'var(--accent)',
      'accent-tint': 'var(--accent-tint)',
      'accent-fg': 'var(--accent-contrast)',

      danger: 'var(--danger)',
      success: 'var(--success)',
    },
    fontFamily: {
      display: 'var(--font-display)',
      ui: 'var(--font-ui)',
      editorial: 'var(--font-editorial)',
    },
    fontSize: {
      hero: ['var(--text-hero)', { lineHeight: 'var(--leading-tight)' }],
      display: ['var(--text-display)', { lineHeight: 'var(--leading-tight)' }],
      h1: ['var(--text-h1)', { lineHeight: 'var(--leading-snug)' }],
      h2: ['var(--text-h2)', { lineHeight: 'var(--leading-snug)' }],
      h3: ['var(--text-h3)', { lineHeight: 'var(--leading-snug)' }],
      body: ['var(--text-body)', { lineHeight: 'var(--leading-normal)' }],
      small: ['var(--text-small)', { lineHeight: 'var(--leading-normal)' }],
      caption: ['var(--text-caption)', { lineHeight: 'var(--leading-normal)' }],
    },
    extend: {
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
        24: 'var(--space-24)',
        32: 'var(--space-32)',
      },
      maxWidth: {
        shell: 'var(--shell-max)',
        measure: 'var(--measure)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        pill: 'var(--radius-pill)',
      },
      letterSpacing: {
        tight: 'var(--tracking-tight)',
        wide: 'var(--tracking-wide)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      aspectRatio: {
        cover: '3 / 4',
      },
    },
  },
  plugins: [],
};

export default config;
