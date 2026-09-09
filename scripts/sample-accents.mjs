#!/usr/bin/env node
/**
 * Samples the per-title accent colour from each cover.
 *
 * Run this whenever cover artwork changes. The accent themes an entire product
 * page — hero ground, rule, buttons — so art that no longer matches its stored
 * accent is immediately obvious and looks like a bug.
 *
 * The algorithm matters. Taking the plain dominant colour returns near-black
 * for any cover with heavy linework, which is useless as a theme. So the paper
 * ground, the ink linework and anything neutral are excluded, and the largest
 * remaining chromatic bucket wins.
 *
 * Mirrors sampleAccent() in apps/web/src/components/admin/product-images.tsx,
 * which does the same thing in a canvas for the admin UI.
 */

import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const COVERS_DIR = fileURLToPath(new URL('../apps/web/public/covers', import.meta.url));

const PAPER = [250, 247, 240];
const PAPER_RAISED = [255, 254, 250];
const INK = [30, 37, 37];

const linear = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const contrast = (a, b) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Same 0.12 mix toward the paper ground as deriveTint() in @zhs/ui. */
const tintOf = (rgb) => toHex(rgb.map((v, i) => PAPER[i] + (v - PAPER[i]) * 0.12));

async function sample(file) {
  const { data, info } = await sharp(file)
    .resize({ width: 140 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bins = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    if (lum > 0.84 || lum < 0.2 || saturation < 0.2) continue;

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

  const rgb = [top.r / top.n, top.g / top.n, top.b / top.n].map(Math.round);
  const vsInk = contrast(rgb, INK);
  const vsPaper = contrast(rgb, PAPER_RAISED);
  const usesInk = vsInk >= vsPaper;

  return {
    accentHex: toHex(rgb),
    accentTintHex: tintOf(rgb),
    foreground: usesInk ? '#1e2525' : '#fffefa',
    ratio: Number(Math.max(vsInk, vsPaper).toFixed(2)),
    passesAA: Math.max(vsInk, vsPaper) >= 4.5,
  };
}

async function main() {
  const files = (await readdir(COVERS_DIR)).filter((n) =>
    ['.jpg', '.jpeg', '.png'].includes(extname(n).toLowerCase()),
  );

  const failures = [];
  console.log('slug'.padEnd(20), 'accent'.padEnd(10), 'tint'.padEnd(10), 'pairs'.padEnd(10), 'ratio');

  for (const file of files.sort()) {
    const slug = basename(file, extname(file));
    const result = await sample(join(COVERS_DIR, file));

    if (!result) {
      console.log(`${slug.padEnd(20)} no chromatic pigment found`);
      failures.push(slug);
      continue;
    }

    console.log(
      slug.padEnd(20),
      result.accentHex.padEnd(10),
      result.accentTintHex.padEnd(10),
      result.foreground.padEnd(10),
      `${result.ratio}:1`,
      result.passesAA ? '' : '  <-- below AA',
    );
    if (!result.passesAA) failures.push(slug);
  }

  if (failures.length > 0) {
    console.log(`\n${failures.length} cover(s) need attention: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Sampling failed:', error);
  process.exit(1);
});
