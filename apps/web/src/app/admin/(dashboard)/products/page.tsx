'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatMoney } from '@zhs/shared';
import {
  CoverPreview,
  useHasHover,
  type PreviewTarget,
} from '@/components/admin/cover-preview';
import { StockStepper } from '@/components/admin/stock-stepper';
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

  /*
   * Folds a settled stock change back into the row.
   *
   * The status comes back with it because a restock past zero clears `sold_out`
   * server-side — the pill two columns over has to follow, or the table shows a
   * title as sold out while its own stock column says there are twelve.
   */
  /*
   * Which row is armed for removal. A single id rather than a per-row flag:
   * only one row can be mid-decision at a time, and arming a second should
   * disarm the first rather than leave two live delete buttons on screen.
   */
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ id: number; message: string } | null>(null);

  /*
   * Delete is refused server-side for anything that has sold, and the refusal
   * explains itself — so the message is shown on the row rather than swallowed,
   * and the row stays armed so Archive is one click away from where they are.
   */
  async function removeRow(row: Row) {
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/admin/admin/products/${row.id}`, { method: 'DELETE' });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError({ id: row.id, message: payload?.message ?? `Could not delete ${row.title}.` });
      return;
    }

    setConfirming(null);
    setRows((prev) => prev.filter((item) => item.id !== row.id));
  }

  async function archiveRow(row: Row) {
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/admin/admin/products/${row.id}/archive`, {
      method: 'POST',
    });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError({ id: row.id, message: payload?.message ?? `Could not archive ${row.title}.` });
      return;
    }

    // Archived titles stay in the admin list — that is the point of the admin
    // list — so the row keeps its place and only the pill changes.
    setConfirming(null);
    setRows((prev) =>
      prev.map((item) => (item.id === row.id ? { ...item, status: 'archived' } : item)),
    );
  }

  function applyStock(id: number, next: { quantity: number; status?: string }) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              inventory: { quantity: next.quantity },
              status: next.status ?? row.status,
            }
          : row,
      ),
    );
  }

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
          <table className="w-full border-collapse text-small sm:min-w-[720px]">
            <thead>
              <tr className="border-b border-ink text-left">
                {/*
                  Type, Stock and Amazon drop out below sm, leaving what a
                  phone is actually used for: finding a title and seeing
                  whether it is published and at what price. Six columns cannot
                  be read on a 390px screen, and a table that has to be dragged
                  sideways to answer "is this one live?" is worse than one that
                  answers it directly. All three are one tap away on the product
                  itself — Amazon parity has a page of its own — and all three
                  return at sm.
                */}
                <th scope="col" className="py-3 pr-4 font-ui font-medium">Title</th>
                <th scope="col" className="hidden py-3 pr-4 font-ui font-medium sm:table-cell">Type</th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">Status</th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">Price</th>
                <th scope="col" className="hidden py-3 pr-4 font-ui font-medium sm:table-cell">Stock</th>
                <th scope="col" className="hidden py-3 pr-4 font-ui font-medium sm:table-cell">Amazon</th>
                <th scope="col" className="py-3 text-right font-ui font-medium">
                  <span className="sr-only">Actions</span>
                </th>
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
                  <td className="hidden py-3 pr-4 text-ink-muted sm:table-cell">{row.type}</td>
                  <td className="py-3 pr-4">
                    {/*
                      inline-block and no wrapping: "coming soon" broke across
                      two lines in the narrow mobile column, and a pill split
                      down the middle stops looking like a pill at all.
                    */}
                    <span
                      className={`inline-block whitespace-nowrap rounded-pill px-2 py-0.5 text-caption ${
                        STATUS_TONE[row.status] ?? ''
                      }`}
                    >
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{formatMoney(row.priceCents, 'USD')}</td>
                  <td className="hidden py-3 pr-4 text-ink-muted sm:table-cell">
                    <StockStepper
                      productId={row.id}
                      title={row.title}
                      quantity={row.inventory?.quantity ?? null}
                      onChange={(next) => applyStock(row.id, next)}
                    />
                  </td>
                  <td className="hidden py-3 pr-4 sm:table-cell">
                    {row.amazonUrl ? (
                      <span className="text-moss">Linked</span>
                    ) : (
                      <span className="text-danger">Missing</span>
                    )}
                  </td>
                  <td className="py-3 text-right align-top">
                    {confirming === row.id ? (
                      <div className="inline-flex flex-col items-end gap-1.5">
                        <div className="flex flex-wrap justify-end gap-3 font-ui text-caption">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeRow(row)}
                            className="text-danger underline underline-offset-2 disabled:opacity-50"
                          >
                            {busy ? 'Working…' : 'Delete for good'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void archiveRow(row)}
                            className="text-ink underline underline-offset-2 disabled:opacity-50"
                          >
                            Archive
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setConfirming(null);
                              setError(null);
                            }}
                            className="text-ink-muted underline underline-offset-2 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                        {error?.id === row.id ? (
                          <p
                            role="alert"
                            className="max-w-[28ch] text-right font-ui text-caption text-danger"
                          >
                            {error.message}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirming(row.id);
                          setError(null);
                        }}
                        className="font-ui text-caption text-ink-muted underline underline-offset-2 hover:text-danger"
                      >
                        Remove<span className="sr-only"> {row.title}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
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
