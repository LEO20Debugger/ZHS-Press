'use client';

import { useEffect, useRef, useState } from 'react';

const STEP = 'h-7 w-7 border border-rule font-ui text-small leading-none text-ink ' +
  'hover:border-ink disabled:opacity-40 disabled:hover:border-rule';

/**
 * Stock control for a catalogue row.
 *
 * Restocking is a batch activity — a delivery arrives and a dozen titles need
 * their counts raised — so it belongs in the list, where the whole shelf is
 * visible at once, rather than behind a dozen separate edit forms.
 *
 * The +/- buttons send a *delta* and the field sends an absolute count. That
 * split is the whole point of the control: the buttons say "one more than
 * whatever is there", which stays correct if a customer checks out mid-click,
 * while the field says "I have counted the shelf, it is this many".
 */
export function StockStepper({
  productId,
  title,
  quantity,
  onChange,
}: {
  productId: number;
  title: string;
  /** Null when the product has no inventory row at all. */
  quantity: number | null;
  /** Reports the settled count, and the status if the save cleared `sold_out`. */
  onChange: (next: { quantity: number; status?: string }) => void;
}) {
  const current = quantity ?? 0;

  const [draft, setDraft] = useState(String(current));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * The field is a draft only while it is being typed in. Once focus leaves,
   * the row is the authority again — otherwise a count changed elsewhere (a
   * sale, another admin) would never reach a field that had been touched once
   * and then abandoned.
   */
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(String(current));
  }, [current]);

  async function send(body: { quantity: number } | { delta: number }) {
    setPending(true);
    setError(null);

    const response = await fetch(`/api/admin/admin/products/${productId}/inventory`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);

    const result = await response?.json().catch(() => null);
    setPending(false);

    if (!response?.ok) {
      // Put the field back to the last known-good count: a rejected save that
      // leaves the typed number sitting there reads as if it had worked.
      setDraft(String(current));
      setError(result?.message ?? 'Could not save.');
      return;
    }

    setError(null);
    onChange({ quantity: result.quantity, status: result.status });
  }

  function commitDraft() {
    const parsed = Number(draft);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setDraft(String(current));
      setError('Whole numbers only.');
      return;
    }
    if (parsed === current) return;
    void send({ quantity: parsed });
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        className={STEP}
        // Nothing below zero, so the control cannot ask for what the server
        // would clamp away anyway.
        disabled={pending || current <= 0}
        onClick={() => void send({ delta: -1 })}
        aria-label={`Reduce stock of ${title}`}
      >
        &minus;
      </button>

      <input
        ref={inputRef}
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') setDraft(String(current));
        }}
        disabled={pending}
        aria-label={`Stock of ${title}`}
        className="w-12 border border-rule bg-paper-raised px-1.5 py-1 text-center font-ui text-small text-ink focus:border-ink focus:outline-none disabled:opacity-40"
      />

      <button
        type="button"
        className={STEP}
        disabled={pending}
        onClick={() => void send({ delta: 1 })}
        aria-label={`Increase stock of ${title}`}
      >
        +
      </button>

      {error ? (
        <span role="alert" className="text-caption text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
