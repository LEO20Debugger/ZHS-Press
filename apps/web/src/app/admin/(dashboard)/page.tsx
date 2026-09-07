'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatMoney } from '@zhs/shared';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';

interface Overview {
  products: { total: number; draft: number; comingSoon: number; available: number };
  submissions: { total: number; unread: number };
  /** Absent entirely for editors — the API does not send it, rather than zeroing it. */
  orders?: { total: number; awaitingFulfilment: number; revenueCents: number };
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <div className="border border-rule bg-paper-raised p-6">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 font-display text-h1">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-colors hover:border-ink">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    void fetch('/api/admin/admin/overview', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div>
      <Eyebrow>Overview</Eyebrow>
      <h1 className="mt-3 font-display text-display">Good to see you.</h1>
      <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />

      {!data ? (
        <p className="mt-10 text-small text-ink-muted">Loading…</p>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Titles live" value={String(data.products.available)} href="/admin/products" />
          <Stat label="Coming soon" value={String(data.products.comingSoon)} href="/admin/products" />
          <Stat label="Drafts" value={String(data.products.draft)} href="/admin/products" />
          <Stat
            label="New submissions"
            value={String(data.submissions.unread)}
            href="/admin/submissions"
          />

          {data.orders ? (
            <>
              <Stat
                label="Awaiting fulfilment"
                value={String(data.orders.awaitingFulfilment)}
                href="/admin/orders"
              />
              <Stat label="Orders" value={String(data.orders.total)} href="/admin/orders" />
              <Stat label="Revenue" value={formatMoney(data.orders.revenueCents, 'USD')} />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
