'use client';

import { useCallback, useEffect, useState } from 'react';

/** What every paged admin list returns alongside its rows. */
export interface PageInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/** Reads the paging fields off an API response, or null if it carries none. */
export function pageInfoOf(body: unknown): PageInfo | null {
  const value = body as Partial<PageInfo> | null;
  if (!value || typeof value.totalPages !== 'number') return null;
  return {
    page: value.page ?? 1,
    perPage: value.perPage ?? 15,
    total: value.total ?? 0,
    totalPages: value.totalPages,
  };
}

function parsePage(raw: string | null): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * The current page of a list, kept in two places.
 *
 * In the address bar (?page=3), so a refresh or a shared link keeps it. And in
 * session storage under `storageKey`, because the way back to a list is often a
 * plain link — "Back to catalogue" is /admin/products — and the page you were
 * on should survive that too.
 *
 * Null until mounted: the server render has neither to read from, and
 * starting at 1 would fetch page 1 before jumping to the remembered page.
 */
export function usePageNumber(storageKey: string): [number | null, (page: number) => void] {
  const [page, setPageState] = useState<number | null>(null);

  useEffect(() => {
    const fromUrl = parsePage(new URLSearchParams(window.location.search).get('page'));
    if (fromUrl) {
      setPageState(fromUrl);
      return;
    }
    try {
      setPageState(parsePage(window.sessionStorage.getItem(storageKey)) ?? 1);
    } catch {
      setPageState(1);
    }
  }, [storageKey]);

  useEffect(() => {
    if (page == null) return;
    const url = new URL(window.location.href);
    if (page > 1) url.searchParams.set('page', String(page));
    else url.searchParams.delete('page');
    window.history.replaceState(null, '', url);
    try {
      window.sessionStorage.setItem(storageKey, String(page));
    } catch {
      // Storage unavailable: the address bar still holds it.
    }
  }, [page, storageKey]);

  const setPage = useCallback((next: number) => setPageState(next), []);
  return [page, setPage];
}

/**
 * Previous / Next controls with a count.
 *
 * Rendered only when there is more than one page. "16–30 of 73" rather than
 * just "Page 2 of 5", because the count is what tells you whether the row you
 * are looking for could be on another page at all.
 */
export function Pager({
  info,
  onPage,
  label,
}: {
  info: PageInfo | null;
  onPage: (page: number) => void;
  /** Names the controls for screen readers, e.g. "Order pages". */
  label: string;
}) {
  if (!info || info.totalPages <= 1) return null;

  const first = (info.page - 1) * info.perPage + 1;
  const last = Math.min(info.page * info.perPage, info.total);

  function go(next: number) {
    onPage(next);
    window.scrollTo({ top: 0 });
  }

  return (
    <nav
      aria-label={label}
      className="mt-6 flex flex-wrap items-center justify-between gap-4 font-ui text-small"
    >
      <p className="text-ink-muted">
        {first}–{last} of {info.total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(info.page - 1)}
          disabled={info.page <= 1}
          className="min-h-[40px] border border-rule bg-paper px-4 hover:border-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <span aria-hidden="true">&larr;</span> Previous
        </button>
        <span className="px-2 text-ink-muted">
          Page {info.page} of {info.totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(info.page + 1)}
          disabled={info.page >= info.totalPages}
          className="min-h-[40px] border border-rule bg-paper px-4 hover:border-ink disabled:pointer-events-none disabled:opacity-40"
        >
          Next <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </nav>
  );
}
