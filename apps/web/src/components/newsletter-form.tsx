'use client';

import { useState, type FormEvent } from 'react';

type State = 'idle' | 'submitting' | 'done' | 'error';

/**
 * Newsletter capture. Active from day one (brief, release timeline).
 *
 * The confirmation copy is deliberately the same whether or not the address was
 * already subscribed, matching the API: anything else turns the form into a way
 * of checking whether a given person is on the list.
 */
export function NewsletterForm({ source = 'site' }: { source?: string }) {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setState('submitting');
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: data.get('email'),
          source,
          website: data.get('website') ?? '',
        }),
      });

      if (!response.ok) throw new Error('Request failed');

      setState('done');
      setMessage('Thank you — check your inbox to confirm.');
      form.reset();
    } catch {
      setState('error');
      setMessage('Something went wrong. Please try again, or email info@zhspress.org.');
    }
  }

  if (state === 'done') {
    return (
      <p role="status" className="font-editorial text-small">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex items-end gap-3 border-b border-ink pb-2">
        <div className="flex-1">
          <label htmlFor={`newsletter-${source}`} className="sr-only">
            Email address
          </label>
          <input
            id={`newsletter-${source}`}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="your@email.com"
            className="w-full bg-transparent font-ui text-small text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="font-ui text-caption uppercase tracking-wide disabled:opacity-50"
        >
          {state === 'submitting' ? 'Sending…' : 'Sign up'}
        </button>
      </div>

      {/*
        Honeypot. Hidden from sight and from assistive technology, and never
        focusable — so a real person cannot fill it in by tabbing.
      */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor={`website-${source}`}>Leave this field empty</label>
        <input id={`website-${source}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state === 'error' ? (
        <p role="alert" className="mt-2 text-caption text-danger">
          {message}
        </p>
      ) : null}
    </form>
  );
}
