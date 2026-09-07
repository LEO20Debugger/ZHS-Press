import Link from 'next/link';
import type { AccentPairing } from '@zhs/shared';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Applies a per-title accent as scoped CSS custom properties.
 *
 * Everything inside then re-themes with no extra classes: `bg-accent`,
 * `text-accent-fg` and `bg-accent-tint` all resolve against this title's
 * colour. The `foreground` comes from the API, which has already run the
 * contrast check — templates never pick a text colour themselves.
 */
export function accentStyle(accent: AccentPairing | null): CSSProperties {
  if (!accent) return {};
  return {
    '--accent': accent.accent,
    '--accent-tint': accent.tint,
    '--accent-contrast': accent.foreground,
  } as CSSProperties;
}

/** A hand-drawn rule. Deliberately not a 1px border — those read as software. */
export function HandDrawnRule({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 8"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`h-2 w-full ${className}`}
    >
      <path
        d="M1 4.2c38-2.3 62 1.4 99 .3 37-1.1 58-2.6 96-1.1 25 1 62 2.4 103 1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

/**
 * Alternating tonal bands are how the page is segmented — with tone, not with
 * dividing lines.
 */
export function Section({
  tone = 'paper',
  children,
  className = '',
  id,
}: {
  tone?: 'paper' | 'deep' | 'ink';
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const tones = {
    paper: 'bg-paper text-ink',
    deep: 'bg-paper-deep text-ink',
    ink: 'bg-ink text-paper',
  } as const;

  return (
    <section id={id} className={`${tones[tone]} py-16 md:py-24 ${className}`}>
      <div className="shell">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="mt-3 text-display">{title}</h2>
        <HandDrawnRule className="mt-4 max-w-[220px] text-accent" />
      </div>
      {action ? (
        <Link href={action.href} className="link-underline text-small font-medium">
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: 'solid' | 'outline' | 'quiet';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /**
   * Only ever passed from a Client Component. This module carries no
   * 'use client' directive, so it compiles as server code when a Server
   * Component imports it and as client code when a client one does.
   */
  onClick?: () => void;
};

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3 font-ui ' +
  'text-small font-medium tracking-wide uppercase transition-colors duration-base ease-out ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_VARIANTS = {
  solid: 'bg-accent text-accent-fg hover:bg-ink hover:text-paper',
  outline: 'border border-ink text-ink hover:bg-ink hover:text-paper',
  quiet: 'border border-rule text-ink-muted hover:border-ink hover:text-ink',
} as const;

export function Button({
  children,
  href,
  variant = 'solid',
  className = '',
  type = 'button',
  disabled,
  onClick,
}: ButtonProps) {
  const classes = `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`;

  if (href && !disabled) {
    const external = href.startsWith('http');
    return (
      <Link
        href={href}
        className={classes}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

/** Sticker badges — rotated slightly, as if applied by hand. */
export function Sticker({
  children,
  tone = 'accent',
}: {
  children: ReactNode;
  tone?: 'accent' | 'ink' | 'quiet';
}) {
  const tones = {
    accent: 'bg-accent text-accent-fg',
    ink: 'bg-ink text-paper',
    quiet: 'bg-paper-deep text-ink-muted',
  } as const;

  return <span className={`sticker ${tones[tone]}`}>{children}</span>;
}
