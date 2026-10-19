'use client';

import { use, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatMoney, parseMoneyToCents, upsertProductSchema } from '@zhs/shared';
import { AccentPicker } from '@/components/admin/accent-picker';
import { Modal } from '@/components/admin/modal';
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
  isLatestIssue: boolean;
  latestUntil: string;

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

/**
 * A title as a URL: "Soar, Volume II!" becomes "soar-volume-ii".
 *
 * Accents are folded rather than dropped, so "Àdùkẹ́" keeps its letters.
 * Matches slugSchema, so whatever this produces passes validation unedited.
 */
function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)
    .replace(/-+$/, '');
}

/** Where the product lives on the storefront — mirrors productHref. */
function sitePath(type: string): string {
  if (type === 'book') return '/books/';
  if (type === 'magazine') return '/magazine/';
  return '/shop/';
}

const TYPES = [
  { value: 'book', label: 'Book' },
  { value: 'magazine', label: 'Magazine' },
  { value: 'stationery', label: 'Stationery' },
] as const;

/** One line per status, saying what it does to the shop — the part that is not obvious. */
const STATUSES = [
  { value: 'draft', label: 'Draft', help: 'Hidden from the shop. Only admins can see it.' },
  {
    value: 'coming_soon',
    label: 'Coming soon',
    help: 'Shown in the shop with a waitlist instead of a buy button. Needs a release date.',
  },
  { value: 'available', label: 'Available', help: 'In the shop and can be bought.' },
  { value: 'sold_out', label: 'Sold out', help: 'Shown in the shop, but cannot be bought.' },
  { value: 'archived', label: 'Archived', help: 'Off the shop. Kept for past orders.' },
] as const;

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
  isLatestIssue: false,
  latestUntil: '',

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
  optional,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow block">
        {label}
        {optional ? <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-muted">optional</span> : null}
      </label>
      <div className="mt-2">{children}</div>
      {hint && !error ? <p className="mt-1.5 text-caption text-ink-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One titled group of the form.
 *
 * The page is a set of these rather than one long column, so each question —
 * what is it, what does it cost, how does it look — reads as its own block and
 * the eye can skip what it does not need today.
 */
function Panel({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-rule bg-paper p-5 sm:p-6">
      {title ? <h2 className="eyebrow">{title}</h2> : null}
      {description ? <p className="mt-1 text-caption text-ink-muted">{description}</p> : null}
      <div className={title || description ? 'mt-5 space-y-5' : 'space-y-5'}>{children}</div>
    </section>
  );
}

export default function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();

  const [form, setForm] = useState<FormState>(EMPTY);
  // What was last loaded or saved, so the page can say when there is unsaved work.
  const [baseline, setBaseline] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /*
   * Whether the slug has been typed by hand. Until it has, a new product's
   * slug follows its title, so the common case needs no thought about URLs at
   * all. An existing product never auto-follows: its URL is already out there.
   */
  const [slugEdited, setSlugEdited] = useState(!isNew);
  const [editingSlug, setEditingSlug] = useState(false);

  /*
   * Confirmation of a save, held open until it is acknowledged. Closing it by
   * any route — the button, Escape, the backdrop — leaves for the catalogue,
   * so the admin never lands back on a form whose work is already committed.
   */
  const [savedOpen, setSavedOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Set once a new product exists, so the confirmation can go straight on to
  // its images — the next thing every new product needs.
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [images, setImages] = useState<Array<{ id: number; url: string; alt: string; position: number }>>([]);

  // The homepage hero, so the form can say which title is currently showing
  // rather than leaving the rule to be inferred.
  const [hero, setHero] = useState<{ id: number; title: string } | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [heroMessage, setHeroMessage] = useState<string | null>(null);

  /*
   * Warm the catalogue route while the confirmation is being read.
   *
   * Leaving is the only thing that modal offers, so its destination is known
   * the moment it opens — fetching it then turns the wait after the click into
   * a wait nobody is looking at. (Next disables prefetching under `next dev`,
   * so this shows its value in a built app.)
   */
  useEffect(() => {
    if (savedOpen) router.prefetch('/admin/products');
  }, [savedOpen, router]);

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
    const promoted = { featured: true, sortOrder: String(payload?.sortOrder ?? form.sortOrder) };
    setForm((prev) => ({ ...prev, ...promoted }));
    setBaseline((prev) => ({ ...prev, ...promoted }));
    setHeroMessage('This title now leads the home page.');
  }

  useEffect(() => {
    if (isNew) return;

    void fetch(`/api/admin/admin/products/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        setImages(p.images ?? []);
        const loaded: FormState = {
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
          isLatestIssue: Boolean(p.issue?.isLatest),
          latestUntil: p.issue?.latestUntil ?? '',

          dimensions: p.stationery?.dimensions ?? '',
          material: p.stationery?.material ?? '',
          stationeryPageCount:
            p.stationery?.pageCount == null ? '' : String(p.stationery.pageCount),
          coverArtist: p.stationery?.coverArtist ?? '',
        };
        setForm(loaded);
        setBaseline(loaded);
      })
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setTitle(value: string) {
    setForm((prev) => ({ ...prev, title: value, slug: slugEdited ? prev.slug : slugify(value) }));
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  /*
   * Ask before throwing away typed work.
   *
   * Only the browser's own prompt is possible on close or reload, and only
   * while there is something to lose — a prompt on a clean form trains people
   * to click through it.
   */
  useEffect(() => {
    if (!dirty || savedOpen) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, savedOpen]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    const priceCents = parseMoneyToCents(form.price);
    if (priceCents == null) {
      setErrors({ priceCents: 'Enter a price like 14.99.' });
      setMessage('Check the highlighted field.');
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
              isLatest: form.isLatestIssue,
              latestUntil: form.isLatestIssue ? form.latestUntil || undefined : undefined,
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
      // The slug lives behind a toggle; open it if that is where the problem is.
      if (fieldErrors.slug) setEditingSlug(true);
      const errorCount = Object.keys(fieldErrors).length;
      setMessage(errorCount === 1 ? 'Check the highlighted field.' : `Check the ${errorCount} highlighted fields.`);
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
        if (fieldErrors.slug) setEditingSlug(true);
      }
      setMessage(result?.message ?? 'Could not save.');
      return;
    }

    setBaseline(form);
    if (isNew && typeof result?.id === 'number') setCreatedId(result.id);
    setSavedOpen(true);
  }

  /*
   * No router.refresh() here, deliberately. The catalogue is a client
   * component that fetches its own rows on mount, so a refresh buys nothing —
   * it only re-renders the server layout around it and adds a round trip
   * between the click and the list appearing.
   *
   * The modal is left open across the navigation rather than closed first: the
   * page is about to unmount anyway, and closing it early flashes the form
   * back up for a frame on the way out.
   */
  function leaveToCatalogue() {
    setLeaving(true);
    router.push('/admin/products');
  }

  if (loading) return <p className="text-small text-ink-muted">Loading…</p>;

  const typeLabel = TYPES.find((t) => t.value === form.type)?.label ?? 'Product';
  const status = STATUSES.find((s) => s.value === form.status) ?? STATUSES[0];
  const priceCents = parseMoneyToCents(form.price);

  return (
    <div className="mx-auto max-w-6xl">
      {/*
        A Link to the catalogue rather than router.back(): history could hold
        anything — a bookmark, a refresh, the page before signing in — and a
        back control that sometimes leaves the admin entirely is worse than
        none. This always lands where the product came from.
      */}
      <Link
        href="/admin/products"
        className="link-underline inline-flex items-center gap-1.5 py-1 text-caption text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">&larr;</span>
        Back to catalogue
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>{isNew ? 'New product' : typeLabel}</Eyebrow>
          <h1 className="mt-3 break-words font-display text-display">
            {form.title || (isNew ? `Untitled ${typeLabel.toLowerCase()}` : 'Edit product')}
          </h1>
          <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />
        </div>

        {!isNew && form.status !== 'draft' && form.status !== 'archived' && baseline.slug ? (
          <a
            href={`${sitePath(baseline.type)}${baseline.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline text-caption text-ink-muted hover:text-ink"
          >
            View in shop &rarr;
          </a>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="mt-8" noValidate>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          {/* ---- Main column: what the product is ---------------------- */}
          <div className="space-y-6">
            <Panel title="Basics">
              <fieldset>
                <legend className="eyebrow">Type</legend>
                {/*
                  Radios styled as a segmented control: three fixed choices are
                  quicker to read side by side than inside a dropdown, and the
                  choice decides which details panel appears below.
                */}
                <div className="mt-2 inline-flex border border-rule" role="radiogroup">
                  {TYPES.map((option) => {
                    const checked = form.type === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`cursor-pointer border-r border-rule px-4 py-2 font-ui text-small last:border-r-0 focus-within:outline focus-within:outline-2 focus-within:outline-ink ${
                          checked ? 'bg-ink text-paper' : 'bg-paper-raised text-ink-muted hover:text-ink'
                        }`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value={option.value}
                          checked={checked}
                          onChange={() => set('type', option.value)}
                          className="sr-only"
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <Field label="Title" id="title" error={errors.title}>
                <input
                  id="title"
                  value={form.title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`${FIELD} text-body`}
                  placeholder={form.type === 'magazine' ? 'e.g. Light, Issue Five' : 'e.g. Soar'}
                />
              </Field>

              <Field label="Subtitle" id="subtitle" optional error={errors.subtitle}>
                <input
                  id="subtitle"
                  value={form.subtitle}
                  onChange={(e) => set('subtitle', e.target.value)}
                  className={FIELD}
                />
              </Field>

              {/*
                The URL, shown as the address it becomes rather than as a bare
                "slug" field. Most people never need to touch it, so it sits
                behind a small Edit link; an error opens it automatically.
              */}
              <div>
                <p className="eyebrow">Web address</p>
                {editingSlug ? (
                  <div className="mt-2">
                    <div className="flex items-stretch">
                      <span className="flex items-center border border-r-0 border-rule bg-paper-deep px-3 font-ui text-caption text-ink-muted">
                        {sitePath(form.type)}
                      </span>
                      <input
                        id="slug"
                        aria-label="Web address"
                        value={form.slug}
                        onChange={(e) => {
                          setSlugEdited(true);
                          set('slug', e.target.value);
                        }}
                        className={FIELD}
                      />
                    </div>
                    {errors.slug ? (
                      <p role="alert" className="mt-1.5 text-caption text-danger">
                        {errors.slug}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-caption text-ink-muted">
                        Lowercase words joined by hyphens.
                        {!isNew ? ' Changing it breaks links people have already shared.' : ''}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-3 font-ui text-small">
                    <span className="break-all text-ink-muted">
                      zhspress.org{sitePath(form.type)}
                      <span className="text-ink">{form.slug || 'your-title-here'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingSlug(true)}
                      className="link-underline text-caption text-ink-muted hover:text-ink"
                    >
                      Edit
                    </button>
                  </p>
                )}
              </div>
            </Panel>

            {/*
              Type-specific detail. Only the block matching the selected type
              is rendered; state for the other two is retained, so switching
              type to look and switching back does not lose anything typed.
            */}
            {form.type === 'book' ? (
              <Panel title="Book details">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Author"
                    id="authorName"
                    hint="Needed before the book can be published."
                    error={errors['book.authorName']}
                  >
                    <input id="authorName" value={form.authorName}
                      onChange={(e) => set('authorName', e.target.value)} className={FIELD} />
                  </Field>
                  <Field label="Illustrator" id="illustratorName" optional error={errors['book.illustratorName']}>
                    <input id="illustratorName" value={form.illustratorName}
                      onChange={(e) => set('illustratorName', e.target.value)} className={FIELD} />
                  </Field>
                </div>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field label="ISBN" id="isbn" optional error={errors['book.isbn']}>
                    <input id="isbn" value={form.isbn}
                      onChange={(e) => set('isbn', e.target.value)} className={FIELD} />
                  </Field>
                  <Field label="Pages" id="bookPageCount" optional error={errors['book.pageCount']}>
                    <input id="bookPageCount" inputMode="numeric" value={form.bookPageCount}
                      onChange={(e) => set('bookPageCount', e.target.value)} className={FIELD} />
                  </Field>
                  <Field label="Age range" id="ageRange" optional error={errors['book.ageRange']}>
                    <input id="ageRange" value={form.ageRange} placeholder="3–7 years"
                      onChange={(e) => set('ageRange', e.target.value)} className={FIELD} />
                  </Field>
                </div>
                <Field label="Format" id="format" optional error={errors['book.format']}>
                  <input id="format" value={form.format} placeholder="Hardback, 240×240mm"
                    onChange={(e) => set('format', e.target.value)} className={FIELD} />
                </Field>
              </Panel>
            ) : null}

            {form.type === 'magazine' ? (
              <Panel title="Issue details">
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field
                    label="Issue number"
                    id="issueNumber"
                    hint="Needed before publishing."
                    error={errors['issue.issueNumber']}
                  >
                    <input id="issueNumber" inputMode="numeric" value={form.issueNumber}
                      onChange={(e) => set('issueNumber', e.target.value)} className={FIELD} />
                  </Field>
                  <Field label="Theme" id="theme" optional error={errors['issue.theme']}>
                    <input id="theme" value={form.theme}
                      onChange={(e) => set('theme', e.target.value)} className={FIELD} />
                  </Field>
                  <Field label="Published" id="publishedDate" optional error={errors['issue.publishedDate']}>
                    <input id="publishedDate" type="date" value={form.publishedDate}
                      onChange={(e) => set('publishedDate', e.target.value)} className={FIELD} />
                  </Field>
                </div>

                <Field label="Editor's note" id="editorNote" optional error={errors['issue.editorNote']}>
                  <textarea id="editorNote" rows={5} value={form.editorNote}
                    onChange={(e) => set('editorNote', e.target.value)} className={FIELD} />
                </Field>

                {/*
                  Which issue leads the magazine page. Only one can, so ticking
                  this stands the previous headline down on save — said plainly
                  here, because that is a change to a page the editor is not
                  looking at.
                */}
                <div className="border-t border-rule pt-5">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={form.isLatestIssue} className="mt-1"
                      onChange={(e) => set('isLatestIssue', e.target.checked)} />
                    <span>
                      <span className="text-small font-medium">Lead the magazine page with this issue</span>
                      <span className="mt-1 block text-caption text-ink-muted">
                        Shows it as &ldquo;The latest issue&rdquo; above the listing. Only one issue at a
                        time — saving this replaces whichever issue holds it now.
                      </span>
                    </span>
                  </label>

                  {form.isLatestIssue ? (
                    <div className="mt-4 max-w-xs">
                      <Field
                        label="Until"
                        id="latestUntil"
                        optional
                        hint="The last day it leads. Leave empty to run until another issue replaces it."
                        error={errors['issue.latestUntil']}
                      >
                        <input id="latestUntil" type="date" value={form.latestUntil}
                          onChange={(e) => set('latestUntil', e.target.value)} className={FIELD} />
                      </Field>
                    </div>
                  ) : null}
                </div>
              </Panel>
            ) : null}

            {form.type === 'stationery' ? (
              <Panel title="Stationery details">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Dimensions" id="dimensions" optional error={errors['stationery.dimensions']}>
                    <input id="dimensions" value={form.dimensions} placeholder="A5, 148×210mm"
                      onChange={(e) => set('dimensions', e.target.value)} className={FIELD} />
                  </Field>
                  <Field label="Material" id="material" optional error={errors['stationery.material']}>
                    <input id="material" value={form.material}
                      onChange={(e) => set('material', e.target.value)} className={FIELD} />
                  </Field>
                  <Field label="Pages" id="stationeryPageCount" optional error={errors['stationery.pageCount']}>
                    <input id="stationeryPageCount" inputMode="numeric" value={form.stationeryPageCount}
                      onChange={(e) => set('stationeryPageCount', e.target.value)} className={FIELD} />
                  </Field>
                  <Field label="Cover artist" id="coverArtist" optional error={errors['stationery.coverArtist']}>
                    <input id="coverArtist" value={form.coverArtist}
                      onChange={(e) => set('coverArtist', e.target.value)} className={FIELD} />
                  </Field>
                </div>
              </Panel>
            ) : null}

            <Panel title="Description">
              <Field
                label="Short description"
                id="blurb"
                optional
                hint="One or two sentences. Shown on shop listings and when the link is shared."
                error={errors.blurb}
              >
                <textarea id="blurb" rows={3} value={form.blurb}
                  onChange={(e) => set('blurb', e.target.value)} className={FIELD} />
              </Field>
              <Field
                label="Full description"
                id="description"
                optional
                hint="Shown on the product page."
                error={errors.description}
              >
                <textarea id="description" rows={8} value={form.description}
                  onChange={(e) => set('description', e.target.value)} className={FIELD} />
              </Field>
            </Panel>

            {/*
              Images and credits attach to a product by id through their own
              endpoints, so they only exist once the product does.
            */}
            {isNew ? (
              <Panel title="Images and contributors">
                <p className="text-small text-ink-muted">
                  Create the product first — then you can add its cover, more images, and the
                  people credited on it.
                </p>
              </Panel>
            ) : (
              <>
                <Panel>
                  <ProductImages
                    productId={Number(id)}
                    images={images}
                    onAccentSampled={(hex) => set('accentHex', hex)}
                    onChanged={setImages}
                  />
                </Panel>
                <Panel>
                  <ProductContributors productId={Number(id)} />
                </Panel>
              </>
            )}
          </div>

          {/* ---- Side column: how it is sold and shown ----------------- */}
          <div className="space-y-6">
            <Panel title="Status and price">
              <Field label="Status" id="status" error={errors.status}>
                <select id="status" value={form.status} onChange={(e) => set('status', e.target.value)}
                  className={FIELD}>
                  {STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="-mt-3 text-caption text-ink-muted">{status.help}</p>

              <Field label="Price" id="price" error={errors.priceCents}>
                <div className="flex items-stretch">
                  <span className="flex items-center border border-r-0 border-rule bg-paper-deep px-3 font-ui text-small text-ink-muted">
                    $
                  </span>
                  <input id="price" value={form.price} onChange={(e) => set('price', e.target.value)}
                    placeholder="14.99" inputMode="decimal" className={FIELD} />
                </div>
              </Field>

              <Field
                label="Release date"
                id="releaseDate"
                optional={form.status !== 'coming_soon'}
                error={errors.releaseDate}
              >
                <input id="releaseDate" type="date" value={form.releaseDate}
                  onChange={(e) => set('releaseDate', e.target.value)} className={FIELD} />
              </Field>
            </Panel>

            <Panel title="Home page">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={form.featured} className="mt-1"
                  onChange={(e) => set('featured', e.target.checked)} />
                <span>
                  <span className="text-small">Feature on the home page</span>
                  <span className="mt-0.5 block text-caption text-ink-muted">
                    Adds it to the featured row.
                  </span>
                </span>
              </label>

              {/*
                The hero is the featured title with the lowest sort order — that
                is how the homepage already picks it. Rather than add a second
                flag that would have to be true on exactly one row, this names
                the rule and gives it a button.
              */}
              {!isNew ? (
                <div className="border-t border-rule pt-5">
                  {isHero ? (
                    <p className="text-small">
                      This is the homepage hero.
                      <span className="mt-0.5 block text-caption text-ink-muted">
                        It fills the top of the home page.
                      </span>
                    </p>
                  ) : (
                    <>
                      <p className="text-caption text-ink-muted">
                        {hero ? `The hero is currently “${hero.title}”.` : 'The home page has no hero.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void promoteToHero()}
                        disabled={promoting || baseline.status !== 'available'}
                        className="mt-3 border border-ink px-4 py-2 font-ui text-small disabled:opacity-50"
                      >
                        {promoting ? 'Setting…' : 'Make this the hero'}
                      </button>
                      {baseline.status !== 'available' ? (
                        <p className="mt-2 text-caption text-ink-muted">
                          Only a title saved as Available can lead the home page.
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
            </Panel>

            <Panel title="Also sold on">
              <Field label="Amazon link" id="amazonUrl" optional error={errors.amazonUrl}>
                <input id="amazonUrl" value={form.amazonUrl} placeholder="https://www.amazon.com/…"
                  onChange={(e) => set('amazonUrl', e.target.value)} className={FIELD} />
              </Field>
            </Panel>

            <Panel>
              <AccentPicker value={form.accentHex} onChange={(hex) => set('accentHex', hex)} />
              {errors.accentHex ? (
                <p role="alert" className="text-caption text-danger">
                  {errors.accentHex}
                </p>
              ) : null}
            </Panel>
          </div>
        </div>

        {/*
          The save bar stays in reach at any scroll depth, and says what state
          the form is in: a page this long otherwise leaves you scrolling to the
          bottom to find out whether anything needs saving.
        */}
        <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-rule bg-paper px-4 py-4 sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p role="status" className={`text-caption ${message ? 'text-danger' : 'text-ink-muted'}`}>
              {message ??
                (dirty
                  ? 'Unsaved changes'
                  : isNew
                    ? 'Fill in the details, then create the product.'
                    : 'All changes saved')}
              {!message && priceCents != null && form.price ? (
                <span className="ml-3 text-ink-muted">· Sells for {formatMoney(priceCents, 'USD')}</span>
              ) : null}
            </p>
            <Button type="submit" disabled={saving || (!isNew && !dirty)}>
              {saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>

      <Modal open={savedOpen} onClose={leaveToCatalogue} title="Saved">
        <div className="p-8">
          <Eyebrow>Catalogue</Eyebrow>
          <h2 className="mt-3 font-display text-display">
            {isNew ? 'Product created' : 'Changes saved'}
          </h2>
          <HandDrawnRule className="mt-4 max-w-[140px] text-moss" />
          <p className="prose-editorial mt-5 text-small text-ink-muted">
            {form.title ? `“${form.title}”` : 'This product'}{' '}
            {isNew ? 'is now in the catalogue. Add its cover next.' : 'is up to date.'}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {createdId != null ? (
              <Button
                type="button"
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  router.push(`/admin/products/${createdId}`);
                }}
              >
                Add images
              </Button>
            ) : null}
            <Button
              type="button"
              variant={createdId != null ? 'outline' : 'solid'}
              onClick={leaveToCatalogue}
              disabled={leaving}
            >
              {leaving ? 'Returning…' : 'Back to catalogue'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
