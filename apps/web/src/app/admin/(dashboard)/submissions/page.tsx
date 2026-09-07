'use client';

import { useEffect, useState } from 'react';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';

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
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch('/api/admin/admin/submissions', { cache: 'no-store' });
    setItems(response.ok ? await response.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

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
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="font-display text-h3">{item.title}</h2>
                  <p className="mt-1 text-small text-ink-muted">
                    {item.name} · {item.email} · {item.genre.replace('_', '-')}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-caption">
                  <span className="rounded-pill bg-paper-deep px-2 py-0.5">{item.status}</span>
                  <button
                    type="button"
                    onClick={() => setOpen(open === item.id ? null : item.id)}
                    aria-expanded={open === item.id}
                    className="link-underline"
                  >
                    {open === item.id ? 'Hide' : 'Read'}
                  </button>
                </div>
              </div>

              {open === item.id ? (
                <div className="mt-4">
                  <p className="prose-editorial whitespace-pre-wrap">{item.synopsis}</p>
                  <div className="mt-4 flex flex-wrap gap-4 text-caption">
                    {(['reviewing', 'accepted', 'declined'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void setStatus(item.id, status)}
                        className="link-underline"
                      >
                        Mark {status}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
