'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';

interface WaitlistGroup {
  productId: number;
  title: string;
  slug: string;
  status: string;
  total: number;
  waiting: number;
}

interface WaitlistEntry {
  id: number;
  email: string;
  createdAt: string;
  notifiedAt: string | null;
  product: { title: string; slug: string } | null;
}

interface Subscriber {
  id: number;
  email: string;
  status: string;
  source: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

interface Summary {
  confirmed: number;
  pending: number;
  unsubscribed: number;
}

function when(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function AudiencePage() {
  const [tab, setTab] = useState<'waitlist' | 'subscribers'>('waitlist');
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden'>('loading');

  const [groups, setGroups] = useState<WaitlistGroup[]>([]);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [productFilter, setProductFilter] = useState<number | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('confirmed');

  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch('/api/admin/admin/waitlist', { cache: 'no-store' }),
      fetch('/api/admin/admin/subscribers/summary', { cache: 'no-store' }),
    ]);

    // These routes are @Roles('admin'); an editor gets a 403 from the API
    // rather than an empty page.
    if (responses.some((response) => response.status === 403)) {
      setState('forbidden');
      return;
    }

    if (responses[0].ok) setGroups(await responses[0].json());
    if (responses[1].ok) setSummary(await responses[1].json());
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== 'waitlist' || state !== 'ready') return;
    const query = productFilter ? `?productId=${productFilter}` : '';
    void fetch(`/api/admin/admin/waitlist/entries${query}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntries)
      .catch(() => undefined);
  }, [tab, state, productFilter]);

  useEffect(() => {
    if (tab !== 'subscribers' || state !== 'ready') return;
    void fetch(`/api/admin/admin/subscribers?status=${statusFilter}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSubscribers)
      .catch(() => undefined);
  }, [tab, state, statusFilter]);

  if (state === 'forbidden') {
    return (
      <div>
        <Eyebrow>Audience</Eyebrow>
        <h1 className="mt-3 font-display text-display">Not available to your account.</h1>
        <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />
        <p className="prose-editorial mt-6 text-ink-muted">
          Waitlist and subscriber details are restricted to admin accounts, because they are
          members of the public&rsquo;s email addresses.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Eyebrow>Audience</Eyebrow>
      <h1 className="mt-3 font-display text-display">Waitlist &amp; subscribers</h1>
      <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />

      <div className="mt-8 flex flex-wrap gap-2">
        {(['waitlist', 'subscribers'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value ? 'true' : undefined}
            className={`border px-3 py-2 font-ui text-small capitalize ${
              tab === value ? 'border-ink bg-ink text-paper-raised' : 'border-rule hover:border-ink'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {state === 'loading' ? <p className="mt-8 text-small text-ink-muted">Loading…</p> : null}

      {state === 'ready' && tab === 'waitlist' ? (
        <div className="mt-8">
          {groups.length === 0 ? (
            <p className="text-small text-ink-muted">Nobody has joined a waitlist yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="eyebrow">By title</h2>
                <a
                  href={`/api/admin/admin/waitlist.csv${productFilter ? `?productId=${productFilter}` : ''}`}
                  className="link-underline text-caption"
                >
                  Download CSV
                </a>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-small">
                  <thead>
                    <tr className="border-b border-ink text-left">
                      <th scope="col" className="py-3 pr-4 font-ui font-medium">Title</th>
                      <th scope="col" className="py-3 pr-4 font-ui font-medium">Status</th>
                      {/* The number that matters before a release. */}
                      <th scope="col" className="py-3 pr-4 font-ui font-medium">Waiting</th>
                      <th scope="col" className="py-3 font-ui font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr
                        key={group.productId}
                        className={`border-b border-rule ${
                          productFilter === group.productId ? 'bg-paper-deep' : ''
                        }`}
                      >
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() =>
                              setProductFilter(
                                productFilter === group.productId ? null : group.productId,
                              )
                            }
                            className="link-underline text-left font-ui"
                          >
                            {group.title}
                          </button>
                        </td>
                        <td className="py-3 pr-4 text-ink-muted">{group.status}</td>
                        <td className="py-3 pr-4 tabular-nums">{group.waiting}</td>
                        <td className="py-3 tabular-nums text-ink-muted">{group.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="eyebrow mt-10">
                {productFilter ? 'Entries for the selected title' : 'Most recent'}
                {productFilter ? (
                  <button
                    type="button"
                    onClick={() => setProductFilter(null)}
                    className="link-underline ml-3 normal-case tracking-normal"
                  >
                    show all
                  </button>
                ) : null}
              </h2>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-small">
                  <thead>
                    <tr className="border-b border-ink text-left">
                      <th scope="col" className="py-3 pr-4 font-ui font-medium">Email</th>
                      <th scope="col" className="hidden py-3 pr-4 font-ui font-medium sm:table-cell">
                        Title
                      </th>
                      <th scope="col" className="py-3 pr-4 font-ui font-medium">Joined</th>
                      <th scope="col" className="py-3 font-ui font-medium">Notified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-rule">
                        <td className="py-3 pr-4 break-all">{entry.email}</td>
                        <td className="hidden py-3 pr-4 text-ink-muted sm:table-cell">
                          {entry.product?.title ?? '—'}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-ink-muted">
                          {when(entry.createdAt)}
                        </td>
                        <td className="whitespace-nowrap py-3 text-ink-muted">
                          {when(entry.notifiedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {state === 'ready' && tab === 'subscribers' ? (
        <div className="mt-8">
          {summary ? (
            <dl className="grid gap-4 sm:grid-cols-3">
              {[
                ['Confirmed', summary.confirmed, 'mailable'],
                ['Pending', summary.pending, 'never clicked confirm'],
                ['Unsubscribed', summary.unsubscribed, 'opted out'],
              ].map(([label, value, note]) => (
                <div key={String(label)} className="border border-rule bg-paper-raised p-4">
                  <dt className="text-caption text-ink-muted">{label}</dt>
                  <dd className="mt-1 font-display text-h2 tabular-nums">{value}</dd>
                  <p className="mt-1 text-caption text-ink-muted">{note}</p>
                </div>
              ))}
            </dl>
          ) : null}

          {/*
            A large and growing Pending count is the clearest signal that
            confirmation email is not arriving — a failure that is otherwise
            completely invisible, because nobody complains about an email they
            never knew to expect.
          */}
          {summary && summary.pending > summary.confirmed && summary.pending > 3 ? (
            <p className="mt-4 border-l-2 border-terracotta pl-4 text-small text-ink-muted">
              More people are pending than confirmed. That usually means confirmation emails are
              not arriving — check the mail transport before assuming it is disinterest.
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {['confirmed', 'pending', 'unsubscribed'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  aria-current={statusFilter === value ? 'true' : undefined}
                  className={`border px-3 py-1.5 font-ui text-caption capitalize ${
                    statusFilter === value
                      ? 'border-ink bg-ink text-paper-raised'
                      : 'border-rule hover:border-ink'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            {/* Confirmed only, always — see AudienceService.subscriberCsv. */}
            <a href="/api/admin/admin/subscribers.csv" className="link-underline text-caption">
              Download confirmed CSV
            </a>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-small">
              <thead>
                <tr className="border-b border-ink text-left">
                  <th scope="col" className="py-3 pr-4 font-ui font-medium">Email</th>
                  <th scope="col" className="hidden py-3 pr-4 font-ui font-medium sm:table-cell">
                    Source
                  </th>
                  <th scope="col" className="py-3 pr-4 font-ui font-medium">Joined</th>
                  <th scope="col" className="py-3 font-ui font-medium">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((subscriber) => (
                  <tr key={subscriber.id} className="border-b border-rule">
                    <td className="py-3 pr-4 break-all">{subscriber.email}</td>
                    <td className="hidden py-3 pr-4 text-ink-muted sm:table-cell">
                      {subscriber.source ?? '—'}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-ink-muted">
                      {when(subscriber.createdAt)}
                    </td>
                    <td className="whitespace-nowrap py-3 text-ink-muted">
                      {when(subscriber.confirmedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {subscribers.length === 0 ? (
            <p className="mt-4 text-small text-ink-muted">Nobody with that status yet.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
