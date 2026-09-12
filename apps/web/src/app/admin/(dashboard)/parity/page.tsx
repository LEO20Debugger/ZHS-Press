'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Eyebrow, HandDrawnRule } from '@/components/primitives';

interface Report {
  total: number;
  linked: number;
  missingAmazon: Array<{ id: number; slug: string; title: string; type: string }>;
  missingIsbn: Array<{ id: number; slug: string; title: string }>;
}

/**
 * Amazon parity (brief s3, s5).
 *
 * Reports rather than automates: the Amazon account is managed by hand, so
 * what helps is a list of what is out of sync and a CSV to reconcile against.
 */
export default function AdminParityPage() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    void fetch('/api/admin/admin/parity', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then(setReport)
      .catch(() => setReport(null));
  }, []);

  return (
    <div className="max-w-3xl">
      <Eyebrow>Amazon</Eyebrow>
      <h1 className="mt-3 font-display text-display">Listing parity</h1>
      <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />
      <p className="prose-editorial mt-6 text-ink-muted">
        Every title on the site should have a matching Amazon listing.
      </p>

      {!report ? (
        <p className="mt-8 text-small text-ink-muted">Loading…</p>
      ) : (
        <>
          <p className="mt-8 font-display text-h2">
            {report.linked} of {report.total} linked
          </p>

          <div className="mt-6">
            <Button href="/api/admin/admin/parity.csv" variant="outline">
              Download CSV
            </Button>
          </div>

          {report.missingAmazon.length > 0 ? (
            <section className="mt-10">
              <h2 className="eyebrow">Missing an Amazon link</h2>
              <ul className="mt-3 divide-y divide-rule border-y border-rule">
                {report.missingAmazon.map((item) => (
                  <li key={item.id} className="flex justify-between py-2.5 text-small">
                    <Link href={`/admin/products/${item.id}`} className="link-underline">
                      {item.title}
                    </Link>
                    <span className="text-ink-muted">{item.type}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {report.missingIsbn.length > 0 ? (
            <section className="mt-10">
              <h2 className="eyebrow">Books missing an ISBN</h2>
              <ul className="mt-3 divide-y divide-rule border-y border-rule">
                {report.missingIsbn.map((item) => (
                  <li key={item.id} className="py-2.5 text-small">
                    <Link href={`/admin/products/${item.id}`} className="link-underline">
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
