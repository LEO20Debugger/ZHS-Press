'use client';

import { useState } from 'react';
import { Button } from './primitives';

type State = 'idle' | 'working' | 'done' | 'invalid' | 'error';

interface Copy {
  heading: string;
  intro: string;
  action: string;
  doneHeading: string;
  doneBody: string;
}

/**
 * The click that completes a newsletter confirm or unsubscribe.
 *
 * The token arrives in the URL and is POSTed from here rather than taking
 * effect when the page loads — see `lib/newsletter-token.ts` for why a GET
 * would hand the decision to whichever spam filter opened the email first.
 */
export function NewsletterTokenAction({
  action,
  token,
  copy,
}: {
  action: 'confirm' | 'unsubscribe';
  token: string;
  copy: Copy;
}) {
  const [state, setState] = useState<State>(token ? 'idle' : 'invalid');

  async function run() {
    setState('working');
    try {
      const response = await fetch(`/api/newsletter/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        setState('done');
        return;
      }

      const detail = await response.json().catch(() => null);
      setState(detail?.reason === 'invalid_token' ? 'invalid' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div role="status">
        <h1 className="text-display">{copy.doneHeading}</h1>
        <p className="prose-editorial mt-6 text-ink-muted">{copy.doneBody}</p>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div role="status">
        <h1 className="text-display">That link has expired</h1>
        <p className="prose-editorial mt-6 text-ink-muted">
          Confirmation links can only be used once. Sign up again from the foot of any page and we
          will send a fresh one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-display">{copy.heading}</h1>
      <p className="prose-editorial mt-6 text-ink-muted">{copy.intro}</p>

      <div className="mt-8">
        <Button type="button" onClick={run} disabled={state === 'working'}>
          {state === 'working' ? 'One moment…' : copy.action}
        </Button>
      </div>

      {state === 'error' ? (
        <p role="alert" className="mt-4 text-caption text-danger">
          Something went wrong at our end. Please try again, or email hello@zhspress.org.
        </p>
      ) : null}
    </div>
  );
}
