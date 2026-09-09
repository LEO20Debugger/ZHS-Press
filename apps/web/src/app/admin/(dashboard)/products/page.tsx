'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatMoney } from '@zhs/shared';
import {
  CoverPreview,
  useHasHover,
  type PreviewTarget,
} from '@/components/admin/cover-preview';
import { Button, Eyebrow, HandDrawnRule } from '@/components/primitives';

interface Row {
  id: number;
  slug: string;
  title: string;
  type: string;
  status: string;
  priceCents: number;
  accentHex: string | null;
  amazonUrl: string | null;
  inventory?: { quantity: number } | null;
  images?: Array<{ url: string; alt: string }>;
}

const STATUS_TONE: Record<string, string> = {
  available: 'bg-moss text-paper-raised',
  coming_soon: 'bg-marigold text-ink',
  sold_out: 'bg-rule text-ink-muted',
  draft: 'bg-paper-deep text-ink-muted',
  archived: 'bg-paper-deep text-ink-muted',
};

export default function AdminProductsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const hasHover = useHasHover();

  useEffect(() => {
    const timer = setTimeout(() => {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      void fetch(`/api/admin/admin/products${query}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setRows(d.items ?? []))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Catalogue</Eyebrow>
          <h1 className="mt-3 font-display text-display">Products</h1>
          <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />
        </div>
        <Button href="/admin/products/new">New product</Button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by title or slug"
        aria-label="Search products"
        className="mt-8 w-full max-w-sm border border-rule bg-paper-raised px-4 py-2.5 font-ui text-small focus:border-ink focus:outline-none"
      />

      {loading ? (
        <p className="mt-8 text-small text-ink-muted">Loading…</p>
      ) : (
        <div
          className="mt-8 overflow-x-auto"
          onScroll={() => setPreview(null)}
        >
          <table className="w-full min-w-[720px] border-collapse text-small">
            <thead>
              <tr className="border-b border-ink text-left">
                <th scope="col" className="py-3 pr-4 font-ui font-medium">Title</th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">Type</th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">Status</th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">Price</th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">Stock</th>
                <th scope="col" className="py-3 font-ui font-medium">Amazon</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-rule transition-colors duration-fast hover:bg-paper"
                  onMouseEnter={(event) => {
                    if (!hasHover) return;
                    const cover = row.images?.[0];
                    if (!cover) return;
                    setPreview({ url: cover.url, alt: cover.alt, title: row.title });
                    setCursor({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    if (preview) setCursor({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => setPreview(null)}
                >
                  <td className="py-3 pr-4">
                    <Link href={`/admin/products/${row.id}`} className="link-underline">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block h-3 w-3 rounded-pill border border-rule"
                          style={{ backgroundColor: row.accentHex ?? 'transparent' }}
                        />
                        {row.title}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">{row.type}</td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-pill px-2 py-0.5 text-caption ${STATUS_TONE[row.status] ?? ''}`}>
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{formatMoney(row.priceCents, 'USD')}</td>
                  <td className="py-3 pr-4 text-ink-muted">{row.inventory?.quantity ?? '—'}</td>
                  <td className="py-3">
                    {row.amazonUrl ? (
                      <span className="text-moss">Linked</span>
                    ) : (
                      <span className="text-danger">Missing</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    Nothing matches that.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <CoverPreview target={preview} x={cursor.x} y={cursor.y} />
    </div>
  );
}
