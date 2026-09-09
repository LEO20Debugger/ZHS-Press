'use client';

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /*
   * A local preview of the staged file, so you can see what you picked before
   * committing it. Object URLs hold the file in memory until revoked, so the
   * previous one is released whenever the selection changes or the panel
   * unmounts.
   */
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(pendingFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pendingFile]);

  /**
   * Stages a chosen file.
   *
   * Uploads straight away when alt text is already present, otherwise holds
   * the file and waits. An earlier version rejected the file outright, which
   * left it selected in an input that would not fire another change event for
   * the same file — so the panel looked broken and there was no way out of it.
   */
  function chooseFile(file: File | undefined) {
    if (!file) return;
    setPendingFile(file);
    setMessage(null);

    // Always clear the input. Without this, re-picking the same file fires no
    // change event and the panel appears dead — which is exactly what happens
    // if the first attempt is rejected for missing alt text.
    if (fileInput.current) fileInput.current.value = '';

    if (alt.trim()) void upload(file);
  }

  async function upload(file: File) {
    if (!alt.trim()) {
      setMessage('Add alt text, then press Upload.');
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const body = new FormData();
      body.append('file', file);
      body.append('alt', alt.trim());

      const response = await fetch(`/api/admin/admin/products/${productId}/images/upload`, {
        method: 'POST',
        body,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        /*
         * Falls back to the status code rather than a bare "Upload failed".
         * A 413 from the platform's request-size limit, a 502 from an
         * unreachable API and a 500 from the server all arrive here with no
         * JSON body to quote, and each needs a different fix — a message that
         * cannot tell them apart sends you looking in the wrong place.
         */
        setMessage(
          payload?.errors?.[0]?.message ??
            payload?.message ??
            `Upload failed (HTTP ${response.status}).`,
        );
        return;
      }

      onChanged(payload.images ?? []);
      setAlt('');
      setPendingFile(null);
      if (fileInput.current) fileInput.current.value = '';

      // Sample straight from the local file, before it has been fetched back
      // over the network — it is already in memory here.
      const objectUrl = URL.createObjectURL(file);
      try {
        const hex = await sampleAccent(objectUrl);
        if (hex) {
          const validation = validateAccent(hex);
          if (validation.valid) {
            onAccentSampled(hex);
            setMessage(
              `Uploaded. Accent set to ${hex} from the artwork — pairs with ` +
                `${validation.foreground} at ${validation.ratio.toFixed(2)}:1.`,
            );
            return;
          }
        }
        setMessage('Uploaded. Could not read a usable accent colour from it.');
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      setMessage('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

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
    const response = await fetch(`/api/admin/admin/products/${productId}/images/${imageId}`, {
      method: 'DELETE',
    });
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
              <img src={image.url} alt={image.alt} className="h-16 w-12 shrink-0 object-cover" />
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

      {/* Alt text first: it applies to whichever route adds the image. */}
      <div className="mt-6">
        <label htmlFor="image-alt" className="eyebrow block">
          Alt text
        </label>
        <p className="mt-0.5 text-caption text-ink-muted">
          Required. Describe the artwork for someone who cannot see it.
        </p>
        <input
          id="image-alt"
          value={alt}
          onChange={(event) => {
            setAlt(event.target.value);
            if (message) setMessage(null);
          }}
          placeholder="Abstract terracotta arcs rising off the top edge"
          className={`mt-2 ${FIELD}`}
        />
      </div>

      {/*
        Dropzone. A real <input type="file"> underneath, visually hidden but
        focusable and labelled, so the whole thing works from the keyboard —
        a div with drag handlers alone is unusable without a mouse.
      */}
      <div
        onDragOver={(event: DragEvent) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          setDragging(false);
          chooseFile(event.dataTransfer?.files?.[0]);
        }}
        className={`mt-4 border-2 border-dashed p-6 text-center transition-colors duration-base ${
          dragging ? 'border-ink bg-accent-tint' : 'border-rule'
        }`}
      >
        <input
          ref={fileInput}
          id="image-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
        <label
          htmlFor="image-file"
          className="cursor-pointer font-ui text-small underline decoration-rule underline-offset-4 hover:decoration-ink"
        >
          Choose an image
        </label>
        <p className="mt-1 text-caption text-ink-muted">
          or drag one here · JPEG, PNG, WebP or AVIF · up to 12MB
        </p>
        {pendingFile ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt=""
                className="h-24 w-auto border border-rule bg-paper-raised object-contain p-1"
              />
            ) : null}
            <span className="max-w-[16rem] truncate text-caption text-ink-muted">
              {busy ? `Uploading ${pendingFile.name}…` : pendingFile.name}
            </span>
            {!busy ? (
              <>
                <Button
                  variant="outline"
                  disabled={!alt.trim()}
                  onClick={() => void upload(pendingFile)}
                >
                  Upload
                </Button>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  className="link-underline text-caption text-ink-muted"
                >
                  Cancel
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Kept for artwork already sitting in the web app's public directory. */}
      <details className="mt-4">
        <summary className="cursor-pointer text-caption text-ink-muted">
          Or reference an image by path
        </summary>
        <form onSubmit={addImage} className="mt-3 flex gap-3">
          <label htmlFor="image-url" className="sr-only">
            Image path or URL
          </label>
          <input
            id="image-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="/covers/soar.jpg"
            className={FIELD}
          />
          <Button type="submit" disabled={busy || !url || !alt} variant="outline">
            Add
          </Button>
        </form>
      </details>

      {/*
        One status line for both routes. role="status" so a screen reader is
        told the upload finished and what accent was derived, rather than the
        result being visible only to someone watching the panel.
      */}
      {message ? (
        <p role="status" className="mt-4 text-caption text-ink-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
