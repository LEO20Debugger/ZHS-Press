'use client';

import { useState } from 'react';

/**
 * A password field with a reveal toggle.
 *
 * The toggle is a real `type="button"` — inside a form, a bare <button>
 * defaults to submit, so leaving that off would sign you in every time you
 * tried to check what you had typed.
 *
 * Its accessible name states the action and changes with the state, so a
 * screen reader user knows both what pressing it does and whether the password
 * is currently visible. `aria-pressed` carries the state for assistive tech
 * that reports toggle buttons.
 */
export function PasswordInput({
  id,
  name,
  autoComplete = 'current-password',
  required = true,
  className = '',
}: {
  id: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={revealed ? 'text' : 'password'}
        required={required}
        autoComplete={autoComplete}
        // Room for the toggle so long passwords do not run underneath it.
        className={`${className} pr-12`}
      />

      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        aria-pressed={revealed}
        // Sits inside the field's border box, vertically centred whatever the
        // field height ends up being.
        className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-ink-muted transition-colors duration-fast hover:text-ink focus-visible:outline-offset-2"
      >
        {revealed ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

/* The icons are decorative: the button's aria-label carries the meaning. */

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.9 4.7A9.9 9.9 0 0 1 12 4.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.2 4.1M6.4 6.4A17 17 0 0 0 2 11s3.6 6.5 10 6.5a9.7 9.7 0 0 0 4-.8" />
      <path d="M10 10a3 3 0 0 0 4 4" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
