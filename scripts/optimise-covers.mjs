#!/usr/bin/env node
/**
 * Compresses cover artwork in place.
 *
 * The generated covers arrive around 800KB each at 896x1200. They are never
 * displayed larger than ~450px wide (the product detail page at 2x density),
 * so the source files carry several times the pixels anyone will ever see.
 * Nine of them on the shop page is close to 7MB of images for a page whose
 * markup is under 15KB.
 *
 * next/image resizes and re-encodes on demand, but it still reads these files
 * and holds them in memory, and the originals sit in the repo forever. So the
 * sources get trimmed to a sensible ceiling once, here.
 *
 * Originals are preserved alongside as .original.jpg the first time this runs,
 * so re-running never compounds compression artefacts.
 */

import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const COVERS_DIR = fileURLToPath(new URL('../apps/web/public/covers', import.meta.url));
const ORIGINALS_DIR = join(COVERS_DIR, 'originals');

/** 1200px tall is 2x the largest rendered size, which is enough for any display. */
const MAX_HEIGHT = 1200;
const QUALITY = 78;

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function main() {
  await mkdir(ORIGINALS_DIR, { recursive: true });

  const entries = (await readdir(COVERS_DIR)).filter((name) =>
    ['.jpg', '.jpeg', '.png'].includes(extname(name).toLowerCase()),
  );

  if (entries.length === 0) {
    console.log('No cover images found.');
    return;
  }

  let before = 0;
  let after = 0;

  for (const name of entries) {
    const source = join(COVERS_DIR, name);
    const archived = join(ORIGINALS_DIR, name);

    // Keep the untouched original exactly once. On a re-run we re-encode from
    // that, never from an already-compressed file.
    if (!existsSync(archived)) {
      await rename(source, archived);
    }

    const originalSize = (await stat(archived)).size;
    before += originalSize;

    const output = await sharp(archived)
      .resize({ height: MAX_HEIGHT, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();

    await sharp(output).toFile(source);

    const newSize = (await stat(source)).size;
    after += newSize;

    const saved = Math.round((1 - newSize / originalSize) * 100);
    console.log(
      `  ${basename(name).padEnd(24)} ${kb(originalSize).padStart(8)} -> ${kb(newSize).padStart(8)}  (-${saved}%)`,
    );
  }

  console.log(
    `\nTotal: ${kb(before)} -> ${kb(after)} ` +
      `(-${Math.round((1 - after / before) * 100)}%) across ${entries.length} files.`,
  );
  console.log('Originals kept in public/covers/originals (git-ignored).');
}

main().catch((error) => {
  console.error('Optimisation failed:', error);
  process.exit(1);
});
