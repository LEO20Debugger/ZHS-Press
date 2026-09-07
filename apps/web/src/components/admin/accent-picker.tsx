'use client';

import { useEffect, useState } from 'react';
import { deriveTint, validateAccent, ACCENT_PALETTE } from '@zhs/ui';

/**
 * Per-title accent picker.
 *
 * Shows the house palette and, for anything typed by hand, the live contrast
 * result. The same `validateAccent` runs on the API before save, so this can
 * only ever be a preview — but showing the editor *why* a colour is refused,
 * and which text colour it pairs with, is the difference between a usable tool
 * and a form that rejects things for no visible reason.
 */
export function AccentPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [custom, setCustom] = useState(value);

  useEffect(() => {
    setCustom(value);
  }, [value]);

  const isHex = /^#[0-9a-fA-F]{6}$/.test(custom);
  const validation = isHex ? validateAccent(custom) : null;
  const tint = isHex && validation?.valid ? deriveTint(custom) : null;

  return (
    <div>
      <p className="eyebrow">Accent colour</p>
      <p className="mt-1 text-caption text-ink-muted">
        Sampled from the cover. Themes the whole product page.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {ACCENT_PALETTE.map((hex) => {
          const option = validateAccent(hex);
          const selected = hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              aria-pressed={selected}
              aria-label={`Accent ${hex}`}
              title={`${hex} — pairs with ${option.foreground} at ${option.ratio.toFixed(2)}:1`}
              className={`h-10 w-10 rounded-pill border-2 transition-colors duration-fast ${
                selected ? 'border-ink' : 'border-transparent hover:border-rule'
              }`}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label htmlFor="accent-hex" className="text-caption text-ink-muted">
          Or paste a hex
        </label>
        <input
          id="accent-hex"
          type="text"
          value={custom}
          placeholder="#b13f2f"
          onChange={(event) => {
            setCustom(event.target.value);
            if (/^#[0-9a-fA-F]{6}$/.test(event.target.value)) onChange(event.target.value);
          }}
          className="w-32 border border-rule bg-paper-raised px-3 py-1.5 font-ui text-small focus:border-ink focus:outline-none"
        />
      </div>

      {validation && !validation.valid ? (
        <p role="alert" className="mt-3 max-w-md text-caption text-danger">
          {validation.reason}
        </p>
      ) : null}

      {validation?.valid && tint ? (
        <div className="mt-4 max-w-md border border-rule">
          <div className="px-4 py-3" style={{ backgroundColor: tint }}>
            <p className="text-caption uppercase tracking-wide" style={{ color: '#1e2525' }}>
              Page background tint
            </p>
          </div>
          <div
            className="px-4 py-3"
            style={{ backgroundColor: custom, color: validation.foreground }}
          >
            <p className="text-caption uppercase tracking-wide">
              Button — text auto-paired at {validation.ratio.toFixed(2)}:1
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
