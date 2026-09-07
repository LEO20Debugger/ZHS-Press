'use client';

import { useState, type FormEvent } from 'react';
import { createSubmissionSchema } from '@zhs/shared';
import { Button } from './primitives';

const GENRES = [
  { value: 'fiction', label: 'Fiction' },
  { value: 'non_fiction', label: 'Non-fiction' },
  { value: 'children', label: "Children's" },
  { value: 'poetry', label: 'Poetry' },
  { value: 'other', label: 'Something else' },
] as const;

const FIELD_CLASS =
  'w-full border border-rule bg-paper-raised px-4 py-3 font-ui text-small text-ink ' +
  'placeholder:text-ink-muted focus:border-ink focus:outline-none';

function Field({
  label,
  htmlFor,
  error,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="eyebrow block">
        {label}
      </label>
      {hint ? <p className="mt-1 text-caption text-ink-muted">{hint}</p> : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p role="alert" className="mt-2 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmissionForm() {
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    /*
     * Validated client-side against the very same schema the API uses, so the
     * two cannot disagree about what is required. The server validates again
     * regardless — this pass is purely to save the writer a round trip.
     */
    const parsed = createSubmissionSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setState('submitting');

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
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
      <div role="status" className="border-l-2 border-terracotta pl-6">
        <h3 className="font-display text-h3">Thank you — we have it.</h3>
        <p className="prose-editorial mt-2 text-ink-muted">
          You will hear from us within six to eight weeks. If it has been longer, do write and
          chase us.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" error={errors.name}>
          <input id="name" name="name" type="text" required autoComplete="name" className={FIELD_CLASS} />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" name="email" type="email" required autoComplete="email" className={FIELD_CLASS} />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="What is it?" htmlFor="genre" error={errors.genre}>
          <select id="genre" name="genre" required defaultValue="" className={FIELD_CLASS}>
            <option value="" disabled>
              Choose one
            </option>
            {GENRES.map((genre) => (
              <option key={genre.value} value={genre.value}>
                {genre.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Working title" htmlFor="title" error={errors.title}>
          <input id="title" name="title" type="text" required className={FIELD_CLASS} />
        </Field>
      </div>

      <Field
        label="Synopsis"
        htmlFor="synopsis"
        hint="A paragraph or two. What is it about, and who is it for?"
        error={errors.synopsis}
      >
        <textarea id="synopsis" name="synopsis" required rows={7} className={FIELD_CLASS} />
      </Field>

      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor="sub-website">Leave this field empty</label>
        <input id="sub-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state === 'error' ? (
        <p role="alert" className="text-caption text-danger">
          Something went wrong sending that. Please try again, or email
          submissions@zhspress.org.
        </p>
      ) : null}

      <Button type="submit" disabled={state === 'submitting'}>
        {state === 'submitting' ? 'Sending…' : 'Send submission'}
      </Button>
    </form>
  );
}
