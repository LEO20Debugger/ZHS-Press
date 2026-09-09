'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PasswordInput } from '@/components/password-input';
import { Button, Eyebrow, HandDrawnRule } from '@/components/primitives';

const FIELD =
  'w-full border border-rule bg-paper-raised px-4 py-3 font-ui text-small text-ink ' +
  'focus:border-ink focus:outline-none';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
      });

      if (!response.ok) {
        // One message for every failure. The API deliberately does not
        // distinguish "no such user" from "wrong password", and neither do we.
        setError('Email or password is incorrect.');
        setSubmitting(false);
        return;
      }

      const next = params.get('next');
      router.replace(next && next.startsWith('/admin') ? next : '/admin');
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-10 space-y-5">
      <div>
        <label htmlFor="email" className="eyebrow block">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="username"
          className={`mt-2 ${FIELD}`} />
      </div>

      <div>
        <label htmlFor="password" className="eyebrow block">
          Password
        </label>
        <div className="mt-2">
          <PasswordInput id="password" name="password" className={FIELD} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-sm py-16">
      <Eyebrow>ZHS Press</Eyebrow>
      <h1 className="mt-4 font-display text-h1">Sign in</h1>
      <HandDrawnRule className="mt-4 max-w-[140px] text-terracotta" />
      <Suspense fallback={<p className="mt-10 text-small text-ink-muted">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
