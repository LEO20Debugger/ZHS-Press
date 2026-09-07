'use client';

import { use, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, parseMoneyToCents, upsertProductSchema } from '@zhs/shared';
import { AccentPicker } from '@/components/admin/accent-picker';
import { Button, Eyebrow, HandDrawnRule } from '@/components/primitives';

const FIELD =
  'w-full border border-rule bg-paper-raised px-4 py-2.5 font-ui text-small text-ink ' +
  'focus:border-ink focus:outline-none';

interface FormState {
  slug: string;
  type: string;
  status: string;
  title: string;
  subtitle: string;
  blurb: string;
  description: string;
  price: string;
  releaseDate: string;
  amazonUrl: string;
  accentHex: string;
  featured: boolean;
  sortOrder: string;
}

const EMPTY: FormState = {
  slug: '',
  type: 'book',
  status: 'draft',
  title: '',
  subtitle: '',
  blurb: '',
  description: '',
  price: '',
  releaseDate: '',
  amazonUrl: '',
  accentHex: '#b13f2f',
  featured: false,
  sortOrder: '0',
};

function Field({
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow block">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-caption text-ink-muted">{hint}</p> : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;

    void fetch(`/api/admin/admin/products/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        setForm({
          slug: p.slug ?? '',
          type: p.type ?? 'book',
          status: p.status ?? 'draft',
          title: p.title ?? '',
          subtitle: p.subtitle ?? '',
          blurb: p.blurb ?? '',
          description: p.description ?? '',
          // Cents to a display string once, here. The form never does money maths.
          price: (p.priceCents / 100).toFixed(2),
          releaseDate: p.releaseDate ?? '',
          amazonUrl: p.amazonUrl ?? '',
          accentHex: p.accentHex ?? '#b13f2f',
          featured: Boolean(p.featured),
          sortOrder: String(p.sortOrder ?? 0),
        });
      })
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    const priceCents = parseMoneyToCents(form.price);
    if (priceCents == null) {
      setErrors({ priceCents: 'Enter a price like 14.99.' });
      return;
    }

    const payload = {
      slug: form.slug.trim(),
      type: form.type,
      status: form.status,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      blurb: form.blurb.trim() || undefined,
      description: form.description.trim() || undefined,
      priceCents,
      releaseDate: form.releaseDate || undefined,
      amazonUrl: form.amazonUrl.trim() || undefined,
      accentHex: form.accentHex || undefined,
      featured: form.featured,
      sortOrder: Number(form.sortOrder) || 0,
    };

    // Same schema the API validates with, so the rules cannot diverge.
    const parsed = upsertProductSchema.safeParse(payload);
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

    const response = await fetch(
      isNew ? '/api/admin/admin/products' : `/api/admin/admin/products/${id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      },
    );

    const result = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      // Server-side field errors — the accent contrast check lands here.
      if (Array.isArray(result?.errors)) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.errors) fieldErrors[issue.field] = issue.message;
        setErrors(fieldErrors);
      }
      setMessage(result?.message ?? 'Could not save.');
      return;
    }

    if (isNew) {
      router.replace(`/admin/products/${result.id}`);
    } else {
      setMessage('Saved.');
    }
  }

  if (loading) return <p className="text-small text-ink-muted">Loading…</p>;

  return (
    <div className="max-w-3xl">
      <Eyebrow>Catalogue</Eyebrow>
      <h1 className="mt-3 font-display text-display">
        {isNew ? 'New product' : form.title || 'Edit product'}
      </h1>
      <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />

      <form onSubmit={onSubmit} className="mt-10 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Title" id="title" error={errors.title}>
            <input id="title" value={form.title} onChange={(e) => set('title', e.target.value)}
              className={FIELD} />
          </Field>

          <Field label="URL slug" id="slug" hint="lowercase-with-hyphens" error={errors.slug}>
            <input id="slug" value={form.slug} onChange={(e) => set('slug', e.target.value)}
              className={FIELD} />
          </Field>
        </div>

        <Field label="Subtitle" id="subtitle" error={errors.subtitle}>
          <input id="subtitle" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)}
            className={FIELD} />
        </Field>

        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="Type" id="type" error={errors.type}>
            <select id="type" value={form.type} onChange={(e) => set('type', e.target.value)}
              className={FIELD}>
              <option value="book">Book</option>
              <option value="magazine">Magazine</option>
              <option value="stationery">Stationery</option>
            </select>
          </Field>

          <Field label="Status" id="status" error={errors.status}>
            <select id="status" value={form.status} onChange={(e) => set('status', e.target.value)}
              className={FIELD}>
              <option value="draft">Draft</option>
              <option value="coming_soon">Coming soon</option>
              <option value="available">Available</option>
              <option value="sold_out">Sold out</option>
              <option value="archived">Archived</option>
            </select>
          </Field>

          <Field label="Price (USD)" id="price" error={errors.priceCents}>
            <input id="price" value={form.price} onChange={(e) => set('price', e.target.value)}
              placeholder="14.99" inputMode="decimal" className={FIELD} />
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="Release date"
            id="releaseDate"
            hint="Required for a coming soon title"
            error={errors.releaseDate}
          >
            <input id="releaseDate" type="date" value={form.releaseDate}
              onChange={(e) => set('releaseDate', e.target.value)} className={FIELD} />
          </Field>

          <Field label="Amazon URL" id="amazonUrl" error={errors.amazonUrl}>
            <input id="amazonUrl" value={form.amazonUrl}
              onChange={(e) => set('amazonUrl', e.target.value)} className={FIELD} />
          </Field>
        </div>

        <Field label="Blurb" id="blurb" hint="Short listing copy" error={errors.blurb}>
          <textarea id="blurb" rows={3} value={form.blurb}
            onChange={(e) => set('blurb', e.target.value)} className={FIELD} />
        </Field>

        <Field label="Description" id="description" hint="Long copy, MDX" error={errors.description}>
          <textarea id="description" rows={7} value={form.description}
            onChange={(e) => set('description', e.target.value)} className={FIELD} />
        </Field>

        <div className="border-t border-rule pt-6">
          <AccentPicker value={form.accentHex} onChange={(hex) => set('accentHex', hex)} />
          {errors.accentHex ? (
            <p role="alert" className="mt-2 text-caption text-danger">
              {errors.accentHex}
            </p>
          ) : null}
        </div>

        <label className="flex items-center gap-3 text-small">
          <input type="checkbox" checked={form.featured}
            onChange={(e) => set('featured', e.target.checked)} />
          <span>Feature on the home page</span>
        </label>

        {message ? (
          <p role="status" className={`text-small ${message === 'Saved.' ? 'text-moss' : 'text-danger'}`}>
            {message}
          </p>
        ) : null}

        <div className="flex items-center gap-4 border-t border-rule pt-6">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
          </Button>
          {!isNew && form.price ? (
            <span className="text-caption text-ink-muted">
              Shows as {formatMoney(parseMoneyToCents(form.price) ?? 0, 'USD')}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
