'use client';

import { useState, type FormEvent } from 'react';
import { deriveTint, validateAccent } from '@zhs/ui';
import { Button } from '../primitives';

interface ProductImage {
  id: number;
  url: string;
  alt: string;
  position: number;
}

const FIELD =
  'w-full border border-rule bg-paper-raised px-3 py-2 font-ui text-small text-ink ' +
  'placeholder:text-ink-muted focus:border-ink focus:outline-none';

/**
 * Samples the dominant pigment from cover artwork.
 *
 * The same approach used to derive the launch accents: ignore the paper ground
 * and the ink linework, keep only chromatic mid-tones, and take the largest
 * bucket. Sampling the raw dominant colour instead returns near-black for any
 * cover with heavy linework, which is useless as a theme colour.
 *
 * Runs in the browser rather than on the server so the API needs no image
 * library. Requires a same-origin image — a cross-origin one taints the canvas
 * and throws, which is handled by the caller.
 */
async function sampleAccent(url: string): Promise<string | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();

  const width = 140;
  const height = Math.round((width * img.naturalHeight) / img.naturalWidth) || 140;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  const bins = new Map<string, { n: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] as number;
    const g = data[i + 1] as number;
    const b = data[i + 2] as number;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // Skip the paper ground, the ink linework, and anything neutral.
    if (luminance > 0.84 || luminance < 0.2 || saturation < 0.2) continue;

    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n += 1;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }

  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  if (!top) return null;

  const hex = (value: number) =>
    Math.round(value / top.n)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(top.r)}${hex(top.g)}${hex(top.b)}`;
}

export function ProductImages({
  productId,
  images,
  onAccentSampled,
  onChanged,
}: {
  productId: number;
  images: ProductImage[];
  onAccentSampled: (hex: string) => void;
  onChanged: (images: ProductImage[]) => void;
}) {
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addImage(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/admin/products/${productId}/images`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), alt: alt.trim() }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.errors?.[0]?.message ?? payload?.message ?? 'Could not add that.');
        return;
      }

      onChanged(payload.images ?? []);
      setUrl('');
      setAlt('');
      setMessage('Image added.');
    } catch {
      setMessage('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(imageId: number) {
    const response = await fetch(
      `/api/admin/admin/products/${productId}/images/${imageId}`,
      { method: 'DELETE' },
    );
    if (response.ok) {
      const payload = await response.json().catch(() => null);
      onChanged(payload?.images ?? []);
    }
  }

  async function sampleFrom(imageUrl: string) {
    setMessage(null);
    try {
      const hex = await sampleAccent(imageUrl);
      if (!hex) {
        setMessage('Could not find a dominant colour in that image.');
        return;
      }

      // Report what will actually happen rather than silently applying a
      // colour the API will reject on save.
      const validation = validateAccent(hex);
      if (!validation.valid) {
        setMessage(`Sampled ${hex}, but it is not readable enough to use as an accent.`);
        return;
      }

      onAccentSampled(hex);
      setMessage(
        `Accent set to ${hex} — pairs with ${validation.foreground} at ` +
          `${validation.ratio.toFixed(2)}:1. Tint ${deriveTint(hex)}.`,
      );
    } catch {
      setMessage('Could not read that image. Cross-origin images cannot be sampled.');
    }
  }

  return (
    <div className="border-t border-rule pt-6">
      <p className="eyebrow">Images</p>
      <p className="mt-1 text-caption text-ink-muted">
        The first image is the cover. Sampling sets the accent colour from the artwork.
      </p>

      {images.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {images.map((image, index) => (
            <li key={image.id} className="flex items-center gap-4 border border-rule p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.alt}
                className="h-16 w-12 shrink-0 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-ui text-small">{image.url}</p>
                <p className="truncate text-caption text-ink-muted">{image.alt}</p>
                {index === 0 ? <p className="text-caption text-moss">Cover</p> : null}
              </div>
              <div className="flex shrink-0 gap-3 text-caption">
                <button
                  type="button"
                  onClick={() => void sampleFrom(image.url)}
                  className="link-underline"
                >
                  Sample accent
                </button>
                <button
                  type="button"
                  onClick={() => void remove(image.id)}
                  className="link-underline text-danger"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-small text-ink-muted">
          No images yet. Without a cover this product renders as an empty frame.
        </p>
      )}

      <form onSubmit={addImage} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="image-url" className="sr-only">
            Image URL
          </label>
          <input
            id="image-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="/covers/soar.jpg"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="image-alt" className="sr-only">
            Alt text
          </label>
          <input
            id="image-alt"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            placeholder="Describe it for screen readers"
            className={FIELD}
          />
        </div>
        <Button type="submit" disabled={busy || !url || !alt} variant="outline">
          {busy ? 'Adding…' : 'Add'}
        </Button>
      </form>

      {message ? (
        <p role="status" className="mt-3 text-caption text-ink-muted">
          {message}
        </p>
      ) : null}

      <p className="mt-4 text-caption text-ink-muted">
        Binary upload is not wired up yet — it needs object storage to be provisioned. Until
        then, drop files into <code>apps/web/public/covers</code> and reference them by path.
      </p>
    </div>
  );
}
