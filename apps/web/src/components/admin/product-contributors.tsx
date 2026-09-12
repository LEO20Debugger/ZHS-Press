'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const ROLES = ['author', 'illustrator', 'editor', 'contributor'] as const;
type Role = (typeof ROLES)[number];

interface Credit {
  contributorId: number;
  name: string;
  slug: string;
  role: Role;
  pieceTitle: string | null;
  position: number;
}

interface Person {
  id: number;
  name: string;
  slug: string;
}

const FIELD =
  'field-control w-full border border-rule bg-paper-raised px-3 py-2 font-ui text-small text-ink ' +
  'focus:border-ink focus:outline-none';

/**
 * Credits for a product.
 *
 * The distinction this interface exists to express: a contributor is a
 * *person*, not a line on one title. The same writer recurs across issues of
 * Light, and the storefront links a name to everything they have appeared in —
 * so typing a name that already exists must attach the existing person rather
 * than quietly create a second record with the same name and a suffixed slug.
 *
 * Hence the search-first flow: type, see who already exists, pick one — and
 * only create someone new when the search genuinely finds nobody.
 */
export function ProductContributors({ productId }: { productId: number }) {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [role, setRole] = useState<Role>('contributor');
  const [pieceTitle, setPieceTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/admin/products/${productId}/contributors`, {
      cache: 'no-store',
    });
    if (response.ok) setCredits(await response.json());
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Debounced search.
   *
   * A request per keystroke would be both wasteful and wrong-ordered — replies
   * can arrive out of sequence, so a slow response to "ad" can land after a
   * fast one to "ada" and overwrite the better results with worse ones. The
   * timer collapses the bursts; the cancelled flag drops any reply that is no
   * longer the current query.
   */
  useEffect(() => {
    if (selected) return;

    const term = query.trim();
    if (term.length < 2) {
      setMatches([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void fetch(`/api/admin/admin/contributors?search=${encodeURIComponent(term)}`, {
        cache: 'no-store',
      })
        .then((response) => (response.ok ? response.json() : []))
        .then((people: Person[]) => {
          if (!cancelled) setMatches(people);
        })
        .catch(() => undefined);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selected]);

  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setQuery('');
    setSelected(null);
    setMatches([]);
    setPieceTitle('');
    setRole('contributor');
  }

  async function attach() {
    const name = query.trim();
    if (!selected && name.length === 0) return;

    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/admin/admin/products/${productId}/contributors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Exactly one of the two, never both — the schema refuses otherwise.
      body: JSON.stringify({
        ...(selected ? { contributorId: selected.id } : { name }),
        role,
        pieceTitle: pieceTitle.trim() || undefined,
      }),
    });

    const payload = await response.json().catch(() => null);
    setBusy(false);

    if (!response.ok) {
      setMessage({ text: payload?.message ?? 'Could not add that credit.', tone: 'error' });
      return;
    }

    setCredits(payload);
    setMessage({
      text: selected ? `Credited ${selected.name}.` : `Added ${name} as a new contributor.`,
      tone: 'info',
    });
    reset();
    inputRef.current?.focus();
  }

  async function detach(credit: Credit) {
    setBusy(true);
    const response = await fetch(
      `/api/admin/admin/products/${productId}/contributors/${credit.contributorId}/${credit.role}`,
      { method: 'DELETE' },
    );
    setBusy(false);
    if (response.ok) setCredits(await response.json());
  }

  async function move(index: number, delta: number) {
    const next = [...credits];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];

    // Optimistic: reordering is cheap to reverse and the list must not lurch
    // while the request is in flight.
    setCredits(next);

    await fetch(`/api/admin/admin/products/${productId}/contributors/order`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contributorIds: next.map((credit) => credit.contributorId) }),
    });
  }

  return (
    <fieldset className="border-t border-rule pt-6">
      <legend className="eyebrow">Contributors</legend>
      <p className="mt-1 text-caption text-ink-muted">
        The writers and artists credited on this title. Search first — the same person recurs
        across issues and should be attached, not retyped.
      </p>

      {credits.length > 0 ? (
        <ul className="mt-4 divide-y divide-rule border-y border-rule">
          {credits.map((credit, index) => (
            <li
              key={`${credit.contributorId}-${credit.role}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-ui text-small">{credit.name}</p>
                <p className="text-caption text-ink-muted">
                  {credit.role}
                  {credit.pieceTitle ? ` · ${credit.pieceTitle}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${credit.name} up`}
                  className="px-2 py-1 text-caption text-ink-muted hover:text-ink disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => void move(index, 1)}
                  disabled={index === credits.length - 1}
                  aria-label={`Move ${credit.name} down`}
                  className="px-2 py-1 text-caption text-ink-muted hover:text-ink disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => void detach(credit)}
                  disabled={busy}
                  aria-label={`Remove ${credit.name} as ${credit.role}`}
                  className="link-underline ml-2 text-caption text-ink-muted hover:text-danger"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-small text-ink-muted">No contributors credited yet.</p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1.4fr_0.8fr_1.2fr_auto]">
        <div className="relative">
          <label htmlFor="contributor-search" className="sr-only">
            Contributor name
          </label>
          <input
            id="contributor-search"
            ref={inputRef}
            value={selected ? selected.name : query}
            onChange={(event) => {
              setSelected(null);
              setQuery(event.target.value);
            }}
            placeholder="Search or add a name"
            autoComplete="off"
            className={FIELD}
          />

          {/*
            Suggestions only while nobody is chosen. Listing existing people as
            you type is the whole mechanism preventing a second "Ada Okonkwo"
            with a -2 slug from being created by accident.
          */}
          {!selected && matches.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto border border-rule bg-paper-raised shadow-[0_8px_24px_-12px_rgba(30,37,37,0.4)]">
              {matches.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(person);
                      setMatches([]);
                    }}
                    className="block w-full px-3 py-2 text-left font-ui text-small hover:bg-paper-deep"
                  >
                    {person.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <label htmlFor="contributor-role" className="sr-only">
            Role
          </label>
          <select
            id="contributor-role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            className={FIELD}
          >
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contributor-piece" className="sr-only">
            Piece title
          </label>
          <input
            id="contributor-piece"
            value={pieceTitle}
            onChange={(event) => setPieceTitle(event.target.value)}
            placeholder="Piece title (optional)"
            className={FIELD}
          />
        </div>

        <button
          type="button"
          onClick={() => void attach()}
          disabled={busy || (!selected && query.trim().length === 0)}
          className="border border-ink bg-ink px-4 py-2 font-ui text-small text-paper-raised disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>

      {selected ? (
        <p className="mt-2 text-caption text-ink-muted">
          Attaching the existing contributor <strong>{selected.name}</strong>.{' '}
          <button type="button" onClick={reset} className="link-underline">
            Clear
          </button>
        </p>
      ) : null}

      {message ? (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`mt-3 text-caption ${message.tone === 'error' ? 'text-danger' : 'text-ink-muted'}`}
        >
          {message.text}
        </p>
      ) : null}
    </fieldset>
  );
}
