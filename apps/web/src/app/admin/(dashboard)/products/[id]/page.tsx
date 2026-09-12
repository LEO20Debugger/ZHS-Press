'use client';

import { use, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, parseMoneyToCents, upsertProductSchema } from '@zhs/shared';
import { AccentPicker } from '@/components/admin/accent-picker';
import { ProductContributors } from '@/components/admin/product-contributors';
import { ProductImages } from '@/components/admin/product-images';
import { Button, Eyebrow, HandDrawnRule } from '@/components/primitives';

const FIELD =
  'field-control w-full border border-rule bg-paper-raised px-4 py-2.5 font-ui text-small text-ink ' +
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

  /*
   * Type-specific detail, held flat and as strings like every other field here.
   *
   * All three sets stay in state regardless of the selected type, so switching
   * type to look at the other fields and switching back does not wipe what was
   * already typed. Only the set matching the type is sent.
   */
  authorName: string;
  illustratorName: string;
  isbn: string;
  bookPageCount: string;
  format: string;
  ageRange: string;

  issueNumber: string;
  theme: string;
  editorNote: string;
  publishedDate: string;

  dimensions: string;
  material: string;
  stationeryPageCount: string;
  coverArtist: string;
}

/** Blank string to undefined, so clearing a field clears the column. */
function text(value: string): string | undefined {
  return value.trim() || undefined;
}

/** Blank to undefined, otherwise a number for Zod to validate. */
function count(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : Number(trimmed);
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

  authorName: '',
  illustratorName: '',
  isbn: '',
  bookPageCount: '',
  format: '',
  ageRange: '',

  issueNumber: '',
  theme: '',
  editorNote: '',
  publishedDate: '',

  dimensions: '',
  material: '',
  stationeryPageCount: '',
  coverArtist: '',
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
    /*
      A full-height column with the control pushed to the bottom.
      Grid items stretch to the tallest in their row, so when one field has a
      hint line and its neighbour does not, mt-auto keeps both controls on the
      same baseline instead of leaving one floating higher than the other.
    */
    <div className="flex h-full flex-col">
      <label htmlFor={id} className="eyebrow block">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-caption text-ink-muted">{hint}</p> : null}
      {/* mt-auto is what does the aligning: it absorbs the slack a field
          without a hint would otherwise leave above its control. */}
      <div className="mt-auto pt-2">{children}</div>
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
  const [images, setImages] = useState<Array<{ id: number; url: string; alt: string; position: number }>>([]);

  // The homepage hero, so the form can say which title is currently showing
  // rather than leaving the rule to be inferred.
  const [hero, setHero] = useState<{ id: number; title: string } | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [heroMessage, setHeroMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    void fetch('/api/admin/admin/hero', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setHero)
      .catch(() => undefined);
  }, [isNew]);

  const isHero = hero != null && !isNew && hero.id === Number(id);

  async function promoteToHero() {
    setPromoting(true);
    setHeroMessage(null);

    const response = await fetch(`/api/admin/admin/products/${id}/hero`, { method: 'POST' });
    const payload = await response.json().catch(() => null);
    setPromoting(false);

    if (!response.ok) {
      setHeroMessage(payload?.message ?? 'Could not set the hero.');
      return;
    }

    setHero(payload);
    // Promotion sets featured and moves the sort order, so the form must
    // reflect that or the next save would write back the stale values.
    setForm((prev) => ({ ...prev, featured: true, sortOrder: String(payload?.sortOrder ?? prev.sortOrder) }));
    setHeroMessage('This title now leads the home page.');
  }

  useEffect(() => {
    if (isNew) return;

    void fetch(`/api/admin/admin/products/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        setImages(p.images ?? []);
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

          // findOne already joins these; they were simply never read.
          authorName: p.book?.authorName ?? '',
          illustratorName: p.book?.illustratorName ?? '',
          isbn: p.book?.isbn ?? '',
          bookPageCount: p.book?.pageCount == null ? '' : String(p.book.pageCount),
          format: p.book?.format ?? '',
          ageRange: p.book?.ageRange ?? '',

          issueNumber: p.issue?.issueNumber == null ? '' : String(p.issue.issueNumber),
          theme: p.issue?.theme ?? '',
          editorNote: p.issue?.editorNote ?? '',
          publishedDate: p.issue?.publishedDate ?? '',

          dimensions: p.stationery?.dimensions ?? '',
          material: p.stationery?.material ?? '',
          stationeryPageCount:
            p.stationery?.pageCount == null ? '' : String(p.stationery.pageCount),
          coverArtist: p.stationery?.coverArtist ?? '',
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

      /*
       * Only the block matching the type is sent. Sending all three would have
       * the service delete the two that do not apply anyway, but it would also
       * push a half-typed magazine issue number through validation for a
       * product that is now a book.
       */
      ...(form.type === 'book'
        ? {
            book: {
              authorName: text(form.authorName),
              illustratorName: text(form.illustratorName),
              isbn: text(form.isbn),
              pageCount: count(form.bookPageCount),
              format: text(form.format),
              ageRange: text(form.ageRange),
            },
          }
        : {}),
      ...(form.type === 'magazine'
        ? {
            issue: {
              issueNumber: count(form.issueNumber),
              theme: text(form.theme),
              editorNote: text(form.editorNote),
              publishedDate: form.publishedDate || undefined,
            },
          }
        : {}),
      ...(form.type === 'stationery'
        ? {
            stationery: {
              dimensions: text(form.dimensions),
              material: text(form.material),
              pageCount: count(form.stationeryPageCount),
              coverArtist: text(form.coverArtist),
            },
          }
        : {}),
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

        {/*
          Type-specific detail.

          Only the block matching the selected type is rendered, because the
          three sets have nothing in common — an ISBN means nothing on a
          journal, and an issue number means nothing on a picture book. State
          for the other two is retained, so switching type to look and switching
          back does not lose anything already typed.
        */}
        {form.type === 'book' ? (
          <fieldset className="border-t border-rule pt-6">
            <legend className="eyebrow">Book details</legend>

            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <Field
                label="Author"
                id="authorName"
                hint="Required before this can leave draft"
                error={errors['book.authorName']}
              >
                <input id="authorName" value={form.authorName}
                  onChange={(e) => set('authorName', e.target.value)} className={FIELD} />
              </Field>

              <Field label="Illustrator" id="illustratorName" error={errors['book.illustratorName']}>
                <input id="illustratorName" value={form.illustratorName}
                  onChange={(e) => set('illustratorName', e.target.value)} className={FIELD} />
              </Field>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <Field label="ISBN" id="isbn" error={errors['book.isbn']}>
                <input id="isbn" value={form.isbn}
                  onChange={(e) => set('isbn', e.target.value)} className={FIELD} />
              </Field>

              <Field label="Pages" id="bookPageCount" error={errors['book.pageCount']}>
                <input id="bookPageCount" inputMode="numeric" value={form.bookPageCount}
                  onChange={(e) => set('bookPageCount', e.target.value)} className={FIELD} />
              </Field>

              <Field label="Age range" id="ageRange" hint="e.g. 3–7 years" error={errors['book.ageRange']}>
                <input id="ageRange" value={form.ageRange}
                  onChange={(e) => set('ageRange', e.target.value)} className={FIELD} />
              </Field>
            </div>

            <div className="mt-6">
              <Field label="Format" id="format" hint="e.g. Hardback, 240×240mm" error={errors['book.format']}>
                <input id="format" value={form.format}
                  onChange={(e) => set('format', e.target.value)} className={FIELD} />
              </Field>
            </div>
          </fieldset>
        ) : null}

        {form.type === 'magazine' ? (
          <fieldset className="border-t border-rule pt-6">
            <legend className="eyebrow">Issue details</legend>

            <div className="mt-4 grid gap-6 sm:grid-cols-3">
              <Field
                label="Issue number"
                id="issueNumber"
                hint="Required before this can leave draft"
                error={errors['issue.issueNumber']}
              >
                <input id="issueNumber" inputMode="numeric" value={form.issueNumber}
                  onChange={(e) => set('issueNumber', e.target.value)} className={FIELD} />
              </Field>

              <Field label="Theme" id="theme" error={errors['issue.theme']}>
                <input id="theme" value={form.theme}
                  onChange={(e) => set('theme', e.target.value)} className={FIELD} />
              </Field>

              <Field label="Published" id="publishedDate" error={errors['issue.publishedDate']}>
                <input id="publishedDate" type="date" value={form.publishedDate}
                  onChange={(e) => set('publishedDate', e.target.value)} className={FIELD} />
              </Field>
            </div>

            <div className="mt-6">
              <Field label="Editor's note" id="editorNote" hint="MDX" error={errors['issue.editorNote']}>
                <textarea id="editorNote" rows={5} value={form.editorNote}
                  onChange={(e) => set('editorNote', e.target.value)} className={FIELD} />
              </Field>
            </div>
          </fieldset>
        ) : null}

        {form.type === 'stationery' ? (
          <fieldset className="border-t border-rule pt-6">
            <legend className="eyebrow">Stationery details</legend>

            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <Field label="Dimensions" id="dimensions" hint="e.g. A5, 148×210mm" error={errors['stationery.dimensions']}>
                <input id="dimensions" value={form.dimensions}
                  onChange={(e) => set('dimensions', e.target.value)} className={FIELD} />
              </Field>

              <Field label="Material" id="material" error={errors['stationery.material']}>
                <input id="material" value={form.material}
                  onChange={(e) => set('material', e.target.value)} className={FIELD} />
              </Field>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <Field label="Pages" id="stationeryPageCount" error={errors['stationery.pageCount']}>
                <input id="stationeryPageCount" inputMode="numeric" value={form.stationeryPageCount}
                  onChange={(e) => set('stationeryPageCount', e.target.value)} className={FIELD} />
              </Field>

              <Field label="Cover artist" id="coverArtist" error={errors['stationery.coverArtist']}>
                <input id="coverArtist" value={form.coverArtist}
                  onChange={(e) => set('coverArtist', e.target.value)} className={FIELD} />
              </Field>
            </div>
          </fieldset>
        ) : null}

        <Field label="Blurb" id="blurb" hint="Short listing copy" error={errors.blurb}>
          <textarea id="blurb" rows={3} value={form.blurb}
            onChange={(e) => set('blurb', e.target.value)} className={FIELD} />
        </Field>

        <Field label="Description" id="description" hint="Long copy, MDX" error={errors.description}>
          <textarea id="description" rows={7} value={form.description}
            onChange={(e) => set('description', e.target.value)} className={FIELD} />
        </Field>

        {/*
          Images come before the accent picker on purpose: the accent is meant
          to be sampled from the cover, so the cover has to be attached first.
        */}
        {!isNew ? (
          <ProductImages
            productId={Number(id)}
            images={images}
            onAccentSampled={(hex) => set('accentHex', hex)}
            onChanged={setImages}
          />
        ) : (
          <p className="border-t border-rule pt-6 text-small text-ink-muted">
            Save the product first, then add its cover.
          </p>
        )}

        {/*
          Credits, and only once the product exists — they are attached by id
          through their own endpoints rather than carried in the form payload,
          the same way images are.

          Shown for every type, not only magazines: a picture book has an
          illustrator, and a journal has a cover artist. The single-name fields
          in the detail sections above are the quick path; this is where a
          title with several named people is built up.
        */}
        {!isNew ? <ProductContributors productId={Number(id)} /> : null}

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
          <span>
            Feature on the home page
            <span className="ml-2 text-caption text-ink-muted">
              shows in the featured row
            </span>
          </span>
        </label>

        {/*
          The hero is the featured title with the lowest sort order — that is
          how the homepage already picks it. Rather than add a second flag that
          would have to be true on exactly one row, this names the rule and
          gives it a button.
        */}
        {!isNew ? (
          <div className="border-t border-rule pt-6">
            <h2 className="eyebrow">Homepage hero</h2>

            {isHero ? (
              <p className="mt-2 text-small">
                This title is the homepage hero.
                <span className="ml-2 text-caption text-ink-muted">
                  It fills the top of the home page.
                </span>
              </p>
            ) : (
              <>
                <p className="mt-2 text-small text-ink-muted">
                  {hero
                    ? `Currently showing “${hero.title}”.`
                    : 'No title is showing — the home page has no hero.'}
                </p>
                <button
                  type="button"
                  onClick={() => void promoteToHero()}
                  disabled={promoting || form.status !== 'available'}
                  className="mt-3 border border-ink px-4 py-2 font-ui text-small disabled:opacity-50"
                >
                  {promoting ? 'Setting…' : 'Make this the hero'}
                </button>
                {form.status !== 'available' ? (
                  <p className="mt-2 text-caption text-ink-muted">
                    Only an available title can be the hero — the home page leads with something
                    that can be bought. Save this as Available first.
                  </p>
                ) : null}
              </>
            )}

            {heroMessage ? (
              <p role="status" className="mt-2 text-caption text-ink-muted">
                {heroMessage}
              </p>
            ) : null}
          </div>
        ) : null}

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
