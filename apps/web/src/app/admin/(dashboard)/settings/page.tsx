'use client';

import { useEffect, useState } from 'react';
import { formatMoney, parseMoneyToCents, shippingZoneSchema } from '@zhs/shared';
import { Button, Eyebrow, HandDrawnRule } from '@/components/primitives';

const FIELD =
  'field-control w-full border border-rule bg-paper-raised px-4 py-2.5 font-ui text-small text-ink ' +
  'focus:border-ink focus:outline-none';

interface Zone {
  id: number;
  zoneName: string;
  countryCodes: string[];
  rateCents: number;
  freeOverCents: number | null;
  isDefault: boolean;
}

/** One zone as the form holds it: strings, so a half-typed price is not lost. */
interface Draft {
  /** Null until the zone is saved for the first time. */
  id: number | null;
  key: string;
  isDefault: boolean;
  zoneName: string;
  countries: string;
  rate: string;
  freeOver: string;
}

function toDraft(zone: Zone): Draft {
  return {
    id: zone.id,
    key: `zone-${zone.id}`,
    isDefault: zone.isDefault,
    zoneName: zone.zoneName,
    countries: zone.countryCodes.join(', '),
    rate: (zone.rateCents / 100).toFixed(2),
    freeOver: zone.freeOverCents == null ? '' : (zone.freeOverCents / 100).toFixed(2),
  };
}

/**
 * Shop settings. Admins only — the nav hides it from editors, and the API
 * refuses them regardless.
 *
 * Shipping is the one setting so far. Each zone saves on its own, so a typo in
 * one does not hold the others hostage, and a save shows the figure customers
 * will now be charged rather than just "saved".
 */
export default function AdminSettingsPage() {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    void fetch('/api/admin/admin/shipping', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((zones: Zone[]) => setDrafts(zones.map(toDraft)))
      .catch(() => setLoadFailed(true));
  }, []);

  function replaceAll(zones: Zone[]) {
    setDrafts((previous) => {
      // Keep any unsaved new zones the admin is still filling in.
      const unsaved = (previous ?? []).filter((draft) => draft.id === null);
      const saved = zones.map(toDraft);
      return [...saved.filter((d) => !d.isDefault), ...unsaved, ...saved.filter((d) => d.isDefault)];
    });
  }

  function addZone() {
    setDrafts((previous) => {
      const list = previous ?? [];
      const draft: Draft = {
        id: null,
        key: `new-${Date.now()}`,
        isDefault: false,
        zoneName: '',
        countries: '',
        rate: '',
        freeOver: '',
      };
      // New zones go above rest-of-world, which always reads last.
      const index = list.findIndex((d) => d.isDefault);
      return index === -1 ? [...list, draft] : [...list.slice(0, index), draft, ...list.slice(index)];
    });
  }

  return (
    <div className="max-w-3xl">
      <Eyebrow>Shop</Eyebrow>
      <h1 className="mt-3 font-display text-display">Settings</h1>
      <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />

      <section className="mt-10" aria-labelledby="shipping-heading">
        <h2 id="shipping-heading" className="font-display text-h2">
          Shipping
        </h2>
        <p className="prose-editorial mt-2 text-small text-ink-muted">
          Charged once per order, by the country it ships to. Countries not listed in any zone use
          the rest-of-world rate. Changes apply to new checkouts straight away; orders already
          placed keep what they were charged.
        </p>

        {loadFailed ? (
          <p role="alert" className="mt-8 text-small text-danger">
            Could not load the shipping zones. Refresh to try again.
          </p>
        ) : drafts === null ? (
          <p className="mt-8 text-small text-ink-muted">Loading…</p>
        ) : (
          <>
            <ul className="mt-8 space-y-4">
              {drafts.map((draft) => (
                <li key={draft.key}>
                  <ZoneCard
                    initial={draft}
                    onSaved={replaceAll}
                    onDiscard={() =>
                      setDrafts((previous) => (previous ?? []).filter((d) => d.key !== draft.key))
                    }
                  />
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <Button variant="outline" onClick={addZone}>
                Add a zone
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ZoneCard({
  initial,
  onSaved,
  onDiscard,
}: {
  initial: Draft;
  onSaved: (zones: Zone[]) => void;
  onDiscard: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const isNew = draft.id === null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setStatus(null);
  }

  async function save() {
    setError(null);

    const rateCents = parseMoneyToCents(draft.rate);
    if (rateCents == null) {
      setError('Enter the rate as an amount, like 4.99. Use 0 for free shipping.');
      return;
    }

    let freeOverCents: number | null = null;
    if (draft.freeOver.trim() !== '') {
      freeOverCents = parseMoneyToCents(draft.freeOver);
      if (freeOverCents == null) {
        setError('Enter the free-shipping threshold as an amount, like 35, or leave it empty.');
        return;
      }
    }

    const parsed = shippingZoneSchema.safeParse({
      zoneName: draft.zoneName,
      countryCodes: draft.isDefault
        ? []
        : draft.countries
            .split(/[\s,]+/)
            .map((code) => code.trim())
            .filter(Boolean),
      rateCents,
      freeOverCents,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the fields and try again.');
      return;
    }

    setBusy(true);
    const response = await fetch(
      isNew ? '/api/admin/admin/shipping' : `/api/admin/admin/shipping/${draft.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      },
    ).catch(() => null);
    const result = await response?.json().catch(() => null);
    setBusy(false);

    if (!response?.ok) {
      setError(result?.message ?? 'Could not save. Try again.');
      return;
    }

    const zones = result as Zone[];
    if (isNew) {
      // The parent re-renders this zone from the server's list, under its id.
      onDiscard();
      onSaved(zones);
      return;
    }

    const fresh = zones.find((zone) => zone.id === draft.id);
    if (fresh) {
      const next = toDraft(fresh);
      setDraft(next);
      setSaved(next);
    }
    onSaved(zones);
    setStatus(summary(parsed.data.rateCents, parsed.data.freeOverCents));
  }

  async function remove() {
    if (isNew) {
      onDiscard();
      return;
    }
    if (!window.confirm(`Remove "${saved.zoneName}"? Its countries will use the rest-of-world rate.`)) {
      return;
    }

    setBusy(true);
    const response = await fetch(`/api/admin/admin/shipping/${draft.id}`, { method: 'DELETE' }).catch(
      () => null,
    );
    const result = await response?.json().catch(() => null);
    setBusy(false);

    if (!response?.ok) {
      setError(result?.message ?? 'Could not remove. Try again.');
      return;
    }

    onDiscard();
    onSaved(result as Zone[]);
  }

  const id = draft.key;

  return (
    <div className="border border-rule bg-paper p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-name`} className="eyebrow block">
            Zone name
          </label>
          <input
            id={`${id}-name`}
            value={draft.zoneName}
            onChange={(e) => set('zoneName', e.target.value)}
            placeholder="e.g. West Africa"
            className={`${FIELD} mt-2`}
          />
        </div>
        {!draft.isDefault ? (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="link-underline mt-7 shrink-0 text-caption text-ink-muted hover:text-danger disabled:opacity-50"
          >
            {isNew ? 'Discard' : 'Remove'}
          </button>
        ) : null}
      </div>

      <div className="mt-5">
        {draft.isDefault ? (
          <p className="text-small text-ink-muted">
            <span className="eyebrow mr-2">Countries</span>
            Every country not listed in another zone.
          </p>
        ) : (
          <>
            <label htmlFor={`${id}-countries`} className="eyebrow block">
              Countries
            </label>
            <p className="mt-0.5 text-caption text-ink-muted">
              Two-letter codes, separated by commas — e.g. NG, GH, KE
            </p>
            <input
              id={`${id}-countries`}
              value={draft.countries}
              onChange={(e) => set('countries', e.target.value)}
              placeholder="NG, GH"
              autoCapitalize="characters"
              className={`${FIELD} mt-2 uppercase`}
            />
          </>
        )}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-rate`} className="eyebrow block">
            Rate (USD)
          </label>
          <input
            id={`${id}-rate`}
            value={draft.rate}
            onChange={(e) => set('rate', e.target.value)}
            placeholder="4.99"
            inputMode="decimal"
            className={`${FIELD} mt-2`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-free`} className="eyebrow block">
            Free shipping over (USD)
          </label>
          <input
            id={`${id}-free`}
            value={draft.freeOver}
            onChange={(e) => set('freeOver', e.target.value)}
            placeholder="Leave empty for never"
            inputMode="decimal"
            className={`${FIELD} mt-2`}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-caption text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button onClick={() => void save()} disabled={busy || (!dirty && !isNew)}>
          {busy ? 'Saving…' : isNew ? 'Add zone' : 'Save'}
        </Button>
        <span role="status" className="text-caption text-ink-muted">
          {status ?? (dirty && !isNew ? 'Unsaved changes' : '')}
        </span>
      </div>
    </div>
  );
}

/** What the customer will now see, in words — the useful confirmation. */
function summary(rateCents: number, freeOverCents: number | null): string {
  const rate = rateCents === 0 ? 'Free shipping' : `${formatMoney(rateCents, 'USD')} per order`;
  return freeOverCents == null
    ? `Saved — ${rate}.`
    : `Saved — ${rate}, free over ${formatMoney(freeOverCents, 'USD')}.`;
}
