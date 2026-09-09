#!/usr/bin/env node
/**
 * Compresses cover artwork in place.
 *
 * Generated covers arrive around 800KB-1.1MB at 896x1200. They are never
 * displayed larger than ~450px wide, so the sources carry several times the
 * pixels anyone will ever see. Nine of them on the shop page is close to 8MB
 * of images for a page whose markup is under 15KB.
 *
 * Re-runs are safe in both directions, which is the fiddly part:
 *
 *  - Running twice on the same artwork must not compound compression, so the
 *    untouched original is archived and every encode reads from that.
 *  - Replacing a cover with new artwork must not be undone. An earlier version
 *    of this script archived only on first sight, so a re-run after new art was
 *    dropped in would re-encode the *old* archived original over the top of it.
 *
 * A manifest records the hash of what we wrote. If the current file matches, it
 * is our own output and the archived original is authoritative. If it does not,
 * the artwork has been replaced and the archive is refreshed from it.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const COVERS_DIR = fileURLToPath(new URL('../apps/web/public/covers', import.meta.url));
const ORIGINALS_DIR = join(COVERS_DIR, 'originals');
const MANIFEST = join(ORIGINALS_DIR, 'manifest.json');

/** 1200px tall is 2x the largest rendered size, enough for any display. */
const MAX_HEIGHT = 1200;
const QUALITY = 78;

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  await mkdir(ORIGINALS_DIR, { recursive: true });
  const manifest = await loadManifest();

  const entries = (await readdir(COVERS_DIR)).filter((name) =>
    ['.jpg', '.jpeg', '.png'].includes(extname(name).toLowerCase()),
  );

  if (entries.length === 0) {
    console.log('No cover images found.');
    return;
  }

  let before = 0;
  let after = 0;
  let replaced = 0;

  for (const name of entries) {
    const source = join(COVERS_DIR, name);
    const archived = join(ORIGINALS_DIR, name);

    const currentHash = sha(await readFile(source));
    const isOurOutput = manifest[name]?.outputHash === currentHash;

    // Archive when we have never seen this file, or when it is artwork we did
    // not produce — meaning it was replaced since the last run.
    if (!existsSync(archived) || !isOurOutput) {
      if (existsSync(archived) && !isOurOutput) {
        console.log(`  ${name}: new artwork detected, re-archiving`);
        replaced += 1;
      }
      await copyFile(source, archived);
    }

    const originalSize = (await stat(archived)).size;
    before += originalSize;

    const output = await sharp(archived)
      .resize({ height: MAX_HEIGHT, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();

    await writeFile(source, output);
    manifest[name] = { outputHash: sha(output), bytes: output.length };

    after += output.length;
    const saved = Math.round((1 - output.length / originalSize) * 100);
    console.log(
      `  ${basename(name).padEnd(24)} ${kb(originalSize).padStart(9)} -> ` +
        `${kb(output.length).padStart(8)}  (-${saved}%)`,
    );
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `\nTotal: ${kb(before)} -> ${kb(after)} ` +
      `(-${Math.round((1 - after / before) * 100)}%) across ${entries.length} files.`,
  );
  if (replaced > 0) {
    console.log(`${replaced} cover(s) had been replaced since the last run.`);
  }
  console.log('Originals kept in public/covers/originals (git-ignored).');
}

main().catch((error) => {
  console.error('Optimisation failed:', error);
  process.exit(1);
});
