'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { renderMarkdown, upsertPageSchema } from '@zhs/shared';
import { Button, Eyebrow, HandDrawnRule } from '@/components/primitives';

interface PageRow {
  id: number;
  slug: string;
  title: string;
  publishedAt: string | null;
  updatedAt: string;
}

const FIELD =
  'field-control w-full border border-rule bg-paper-raised px-3 py-2 font-ui text-small text-ink ' +
  'focus:border-ink focus:outline-none';

/**
 * The pages the storefront looks for.
 *
 * Offered as a fixed list rather than a free slug field, because these are not
 * arbitrary pages — each corresponds to a route that already exists and will
 * use this copy if it finds it. Inventing `/abuot` here would create a page
 * nothing renders, with no hint as to why.
 */
const KNOWN = [
  { slug: 'about', label: 'About', route: '/about' },
  { slug: 'submissions', label: 'Submissions', route: '/submissions' },
] as const;

const BLANK = {
  slug: 'about',
  title: '',
  body: '',
  seoTitle: '',
  seoDescription: '',
  published: false,
};

export default function AdminPagesPage() {
  const [rows, setRows] = useState<PageRow[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    const response = await fetch('/api/admin/admin/pages', { cache: 'no-store' });
    if (response.ok) setRows(await response.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const open = useCallback(async (slug: string) => {
    setMessage(null);
    setErrors({});

    const response = await fetch(`/api/admin/admin/pages/${slug}`, { cache: 'no-store' });

    if (!response.ok) {
      // No row yet: start a blank one for this slug rather than erroring. The
      // first save creates it.
      setForm({ ...BLANK, slug, title: KNOWN.find((k) => k.slug === slug)?.label ?? '' });
      return;
    }

    const page = await response.json();
    setForm({
      slug: page.slug,
      title: page.title ?? '',
      body: page.bodyMdx ?? '',
      seoTitle: page.seoTitle ?? '',
      seoDescription: page.seoDescription ?? '',
      published: Boolean(page.publishedAt),
    });
  }, []);

  useEffect(() => {
    void open('about');
  }, [open]);

  // Rendered with the same function the storefront uses, so the preview cannot
  // flatter the result.
  const preview = useMemo(() => renderMarkdown(form.body), [form.body]);

  async function save() {
    setMessage(null);

    const parsed = upsertPageSchema.safeParse({
      slug: form.slug,
      title: form.title.trim(),
      body: form.body,
      seoTitle: form.seoTitle.trim() || undefined,
      seoDescription: form.seoDescription.trim() || undefined,
      published: form.published,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'form';
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSaving(true);

    const response = await fetch('/api/admin/admin/pages', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    setSaving(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage({ text: payload?.message ?? 'Could not save that page.', tone: 'error' });
      return;
    }

    setMessage({
      text: form.published
        ? 'Saved and published — this is now live on the site.'
        : 'Saved as a draft. The site still shows its built-in copy.',
      tone: 'info',
    });
    await loadList();
  }

  const current = rows.find((row) => row.slug === form.slug);

  return (
    <div>
      <Eyebrow>Content</Eyebrow>
      <h1 className="mt-3 font-display text-display">Pages</h1>
      <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />
      <p className="prose-editorial mt-5 max-w-2xl text-ink-muted">
        Copy for the About and Submissions pages. Until a page is published here, the site shows
        the wording built into it — so drafting never replaces what visitors currently see.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {KNOWN.map((known) => {
          const row = rows.find((r) => r.slug === known.slug);
          const active = form.slug === known.slug;
          return (
            <button
              key={known.slug}
              type="button"
              onClick={() => void open(known.slug)}
              aria-current={active ? 'true' : undefined}
              className={`border px-3 py-2 font-ui text-small ${
                active ? 'border-ink bg-ink text-paper-raised' : 'border-rule hover:border-ink'
              }`}
            >
              {known.label}
              <span className={`ml-2 text-caption ${active ? 'opacity-80' : 'text-ink-muted'}`}>
                {loading ? '' : row?.publishedAt ? 'live' : row ? 'draft' : 'not created'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label htmlFor="page-title" className="eyebrow block">
              Title
            </label>
            <input
              id="page-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className={`${FIELD} mt-2`}
            />
            {errors.title ? (
              <p role="alert" className="mt-1.5 text-caption text-danger">
                {errors.title}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="page-body" className="eyebrow block">
              Body
            </label>
            <p className="mt-0.5 text-caption text-ink-muted">
              Markdown. <code>## Heading</code>, <code>**bold**</code>, <code>*italic*</code>,{' '}
              <code>- list</code>, <code>[link](/shop)</code>. A blank line starts a new paragraph.
            </p>
            <textarea
              id="page-body"
              rows={18}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              className={`${FIELD} mt-2 font-mono`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="page-seo-title" className="eyebrow block">
                SEO title
              </label>
              <input
                id="page-seo-title"
                value={form.seoTitle}
                onChange={(event) => setForm({ ...form, seoTitle: event.target.value })}
                className={`${FIELD} mt-2`}
              />
            </div>
            <div>
              <label htmlFor="page-seo-description" className="eyebrow block">
                SEO description
              </label>
              <input
                id="page-seo-description"
                value={form.seoDescription}
                onChange={(event) => setForm({ ...form, seoDescription: event.target.value })}
                className={`${FIELD} mt-2`}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(event) => setForm({ ...form, published: event.target.checked })}
              className="h-4 w-4 accent-terracotta"
            />
            <span className="font-ui text-small">
              Published
              <span className="ml-2 text-caption text-ink-muted">
                {form.published ? 'this copy replaces the built-in wording' : 'site keeps its built-in wording'}
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save page'}
            </Button>
            {current ? (
              <a
                href={KNOWN.find((k) => k.slug === form.slug)?.route ?? '/'}
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline text-caption"
              >
                View on site
              </a>
            ) : null}
          </div>

          {message ? (
            <p
              role={message.tone === 'error' ? 'alert' : 'status'}
              className={`text-caption ${message.tone === 'error' ? 'text-danger' : 'text-ink-muted'}`}
            >
              {message.text}
            </p>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="eyebrow">Preview</h2>
          <div className="mt-2 border border-rule bg-paper-raised p-6">
            {form.body.trim() ? (
              /*
                The preview renders through the same renderMarkdown the
                storefront uses, so what is shown here cannot be kinder than
                what ships. That function escapes its input before doing
                anything else, which is why this dangerouslySetInnerHTML is
                safe — see packages/shared/src/markdown.ts.
              */
              <div
                className="prose-editorial"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            ) : (
              <p className="text-small text-ink-muted">Nothing to preview yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
