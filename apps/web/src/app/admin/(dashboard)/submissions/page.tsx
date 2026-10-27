'use client';

import { useCallback, useEffect, useState } from 'react';
import { IconCheck, IconClose, IconSubmissions, IconView } from '@/components/admin/icons';
import { Pager, pageInfoOf, usePageNumber, type PageInfo } from '@/components/admin/pager';
import { RowMenu } from '@/components/admin/row-menu';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';

/** The decisions a submission moves through, as menu items. */
const STATUSES = [
  { value: 'reviewing', label: 'Mark reviewing', icon: <IconView size={16} /> },
  { value: 'accepted', label: 'Mark accepted', icon: <IconCheck size={16} /> },
  { value: 'declined', label: 'Mark declined', icon: <IconClose size={16} /> },
] as const;

interface Submission {
  id: number;
  name: string;
  email: string;
  genre: string;
  title: string;
  synopsis: string;
  status: string;
  createdAt: string;
}

export default function AdminSubmissionsPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [info, setInfo] = useState<PageInfo | null>(null);
  const [page, setPage] = usePageNumber('zhs-admin-submissions-page');
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (page == null) return;
    const response = await fetch(`/api/admin/admin/submissions?page=${page}`, { cache: 'no-store' });
    const body = response.ok ? await response.json() : null;
    const pageInfo = pageInfoOf(body);

    if (pageInfo && page > pageInfo.totalPages) {
      setPage(pageInfo.totalPages);
      return;
    }

    setItems(body?.items ?? []);
    setInfo(pageInfo);
    setLoading(false);
  }, [page, setPage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: number, status: string) {
    await fetch(`/api/admin/admin/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <div>
      <Eyebrow>Submissions</Eyebrow>
      <h1 className="mt-3 font-display text-display">Manuscripts and pitches</h1>
      <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />

      {loading ? (
        <p className="mt-8 text-small text-ink-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-small text-ink-muted">Nothing submitted yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-rule border-y border-rule">
          {items.map((item) => (
            <li key={item.id} className="py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {/*
                    The title opens the synopsis, so reading — the thing done
                    most here — stays one click. A real button with
                    aria-expanded, so a screen reader announces it as a toggle.
                  */}
                  <h2 className="font-display text-h3">
                    <button
                      type="button"
                      onClick={() => setOpen(open === item.id ? null : item.id)}
                      aria-expanded={open === item.id}
                      aria-controls={`submission-${item.id}`}
                      className="link-underline text-left"
                    >
                      {item.title}
                    </button>
                  </h2>
                  <p className="mt-1 break-words text-small text-ink-muted">
                    {item.name} · {item.email} · {item.genre.replace('_', '-')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-caption">
                  <span className="rounded-pill bg-paper-deep px-2 py-0.5">{item.status}</span>
                  {/*
                    The same ⋯ menu as orders and the catalogue. The status
                    options leave out the one the submission already has, so
                    every choice in the menu changes something.
                  */}
                  <RowMenu
                    label={`Actions for “${item.title}”`}
                    items={[
                      {
                        label: open === item.id ? 'Hide synopsis' : 'Read synopsis',
                        icon: <IconView size={16} />,
                        onSelect: () => setOpen(open === item.id ? null : item.id),
                      },
                      {
                        label: 'Email writer',
                        icon: <IconSubmissions size={16} />,
                        onSelect: () => {
                          window.location.href = `mailto:${item.email}?subject=${encodeURIComponent(
                            `Your submission: ${item.title}`,
                          )}`;
                        },
                      },
                      ...STATUSES.filter((status) => status.value !== item.status).map((status) => ({
                        label: status.label,
                        icon: status.icon,
                        onSelect: () => void setStatus(item.id, status.value),
                      })),
                    ]}
                  />
                </div>
              </div>

              {open === item.id ? (
                <div id={`submission-${item.id}`} className="mt-4">
                  <p className="prose-editorial whitespace-pre-wrap">{item.synopsis}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Pager
        info={loading ? null : info}
        onPage={(next) => {
          setPage(next);
          setOpen(null);
        }}
        label="Submission pages"
      />
    </div>
  );
}
