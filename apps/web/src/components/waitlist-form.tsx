'use client';

import { useState, type FormEvent } from 'react';

/** "Notify me" on an unreleased title (brief 2.2). */
export function WaitlistForm({ productId, title }: { productId: number; title: string }) {
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setState('submitting');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId,
          email: data.get('email'),
          website: data.get('website') ?? '',
        }),
      });
      if (!response.ok) throw new Error('Request failed');
      setState('done');
      form.reset();
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <p role="status" className="font-editorial text-small">
        You are on the list. We will email you when <em>{title}</em> is out.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex items-end gap-3 border-b border-ink pb-2">
        <label htmlFor={`waitlist-${productId}`} className="sr-only">
          Email address
        </label>
        <input
          id={`waitlist-${productId}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="your@email.com"
          className="w-full bg-transparent font-ui text-small placeholder:text-ink-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="whitespace-nowrap font-ui text-caption uppercase tracking-wide disabled:opacity-50"
        >
          {state === 'submitting' ? 'Sending…' : 'Notify me'}
        </button>
      </div>

      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor={`wl-website-${productId}`}>Leave this field empty</label>
        <input id={`wl-website-${productId}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state === 'error' ? (
        <p role="alert" className="mt-2 text-caption text-danger">
          Something went wrong. Please try again.
        </p>
      ) : null}
    </form>
  );
}
