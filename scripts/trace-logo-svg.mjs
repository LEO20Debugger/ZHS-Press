#!/usr/bin/env node
/**
 * Traces the raster logo into SVG.
 *
 *   pnpm brand:svg
 *
 * **This is a reconstruction, not the designer's original.** Potrace fits
 * curves to a bitmap's edges; it does not recover the paths the logo was drawn
 * with. The result is usually indistinguishable at screen sizes — this script
 * measures exactly how close, see below — but if the press can supply the
 * vector original, prefer it and delete this.
 *
 * Why bother at all:
 *
 * - It scales to any size, where the 260px raster goes soft on a large screen
 *   and the 640px lockup is a 28KB download for a logo.
 * - `fill="currentColor"` means the colour comes from CSS, so one file serves
 *   both the dark and light colourways and the tint question disappears.
 *
 * The trace runs on the **alpha channel**, not the visible pixels. The source
 * is a transparent PNG whose two colourways are black and white, so thresholding
 * on brightness would find one copy and miss the other; alpha is what actually
 * describes the shape in both.
 */
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';
import potrace from 'potrace';

const root = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = join(root, 'design/zhs-logo.png');
const OUT_DIR = join(root, 'apps/web/public/brand');

const trace = promisify(potrace.trace);

/** Same measured crops as build-brand-assets.mjs. */
const CROPS = {
  mark: { left: 4179, top: 0, width: 3202, height: 1494 },
  lockup: { left: 4179, top: 0, width: 3202, height: 2250 },
  /*
   * The tagline alone, measured by finding the blank band of rows between the
   * boxed mark and the words beneath it.
   *
   * It exists so the header can set the lockup *horizontally* — mark, then
   * tagline beside it. Stacked, as the artwork supplies it, a 40px header row
   * would render each line of the tagline about 5px tall.
   */
  tagline: { left: 4185, top: 1532, width: 3192, height: 706 },
};

async function clampCrop(crop) {
  const { width, height } = await sharp(SOURCE).metadata();
  const left = Math.max(0, Math.min(crop.left, width - 1));
  const top = Math.max(0, Math.min(crop.top, height - 1));
  return {
    left,
    top,
    width: Math.min(crop.width, width - left),
    height: Math.min(crop.height, height - top),
  };
}

/**
 * Renders the crop's alpha as a black-on-white bitmap for potrace.
 *
 * Potrace wants "dark = ink". The alpha mask is the opposite — opaque ink is
 * 255 — so it is negated. It is also rendered at full source resolution: the
 * tracer's accuracy is bounded by the bitmap it is given, and downsampling
 * first would bake stair-stepping into the curves permanently.
 */
async function inkBitmap(crop) {
  return sharp(SOURCE)
    .extract(crop)
    .ensureAlpha()
    .extractChannel('alpha')
    .negate()
    .toColourspace('b-w')
    .png()
    .toBuffer();
}

/**
 * Strips potrace's hard-coded colour and fixed dimensions.
 *
 * Potrace emits `fill="#000000"` plus width/height attributes. Replacing the
 * fill with `currentColor` lets CSS colour it — which is the entire point of
 * shipping a vector — and dropping width/height in favour of viewBox alone
 * makes it scale to whatever box it is placed in.
 */
function normalise(svg, title, fill) {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '';

  /*
   * Inner fills are stripped BEFORE the outer one is set, and the order is the
   * whole point.
   *
   * Potrace puts `fill="black"` on the <path> itself. Left there it wins over
   * anything on the <svg>, so `currentColor` silently does nothing and the mark
   * renders black on every ground. Stripping afterwards is no better: a baked
   * colour like #1e2525 matches the same pattern and gets removed along with it,
   * which is exactly how the lockup lost its ink colour on the first attempt.
   */
  const stripped = svg.replace(/\s+fill="(?:#[0-9a-fA-F]{3,8}|black|white|none)"/g, '');

  return stripped
    .replace(
      /<svg[^>]*>/,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
        `role="img" aria-label="${title}" fill="${fill}">`,
    )
    .replace(/\s+$/, '')
    .concat('\n');
}

/**
 * Rounds coordinates and strips separator noise.
 *
 * Potrace emits three decimal places against a ~3200-unit viewBox, which is a
 * precision of one part in three million — far past what any display, or any
 * printer, can resolve. Rounding to whole units leaves a worst-case error of
 * half a unit, about 0.015% of the logo's width, and roughly halves the file.
 *
 * Safe to do bluntly because potrace's output is *absolute* (M/C/L, not
 * m/c/l): each coordinate is independent, so rounding cannot accumulate drift
 * along the path the way it would with relative commands.
 *
 * The fidelity check below runs on the rounded output, so the number reported
 * is the number that ships.
 */
function compressPaths(svg, decimals = 0) {
  const factor = 10 ** decimals;
  return svg.replace(/ d="([^"]+)"/g, (_match, d) => {
    const compact = d
      .replace(/-?\d+\.?\d*/g, (n) => String(Math.round(Number(n) * factor) / factor))
      .replace(/,\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s([A-Za-z])\s/g, '$1')
      .trim();
    return ` d="${compact}"`;
  });
}

/**
 * Renders the traced SVG back to a bitmap and compares it with the source.
 *
 * The only honest way to report trace quality. "Looks fine" is not a
 * measurement, and a tracer failing on a thin stroke or a tight inside corner
 * is exactly the kind of thing that survives a glance and shows up on a
 * business card.
 */
async function fidelity(svg, crop) {
  const W = 1000;
  const H = Math.round((W * crop.height) / crop.width);

  const traced = await sharp(Buffer.from(svg))
    .resize(W, H, { fit: 'fill' })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  const original = await sharp(SOURCE)
    .extract(crop)
    .ensureAlpha()
    .extractChannel('alpha')
    .negate()
    .resize(W, H, { fit: 'fill' })
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  let differing = 0;
  let inkPixels = 0;
  for (let i = 0; i < original.length; i++) {
    const a = original[i] < 128 ? 1 : 0; // 1 = ink
    const b = traced[i] < 128 ? 1 : 0;
    if (a) inkPixels++;
    if (a !== b) differing++;
  }

  return {
    differingPixels: differing,
    totalPixels: original.length,
    percentOfCanvas: ((differing / original.length) * 100).toFixed(3),
    percentOfInk: ((differing / Math.max(inkPixels, 1)) * 100).toFixed(2),
  };
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`\n  Source artwork not found: ${SOURCE}\n`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  /*
   * `fill` differs by how each asset is used, and this is the detail that
   * catches people out: an SVG loaded through <img src> is an isolated
   * document, so `currentColor` in it resolves against *its own* default —
   * black — not the colour of the page around it.
   *
   * So the mark, which is inlined into the markup, keeps currentColor and
   * inherits whatever text colour it sits in. The lockup is referenced as a
   * file and therefore has its colour baked to --ink.
   */
  const jobs = [
    {
      name: 'logo-mark.svg',
      crop: CROPS.mark,
      title: 'ZHS Press',
      raster: 'logo-mark.png',
      fill: 'currentColor',
      component: 'apps/web/src/components/logo-mark.tsx',
    },
    {
      name: 'logo-lockup.svg',
      crop: CROPS.lockup,
      title: 'Zenith Highest Story-Telling Press',
      raster: 'logo-lockup.png',
      fill: '#1e2525', // --ink
    },
    {
      name: 'logo-tagline.svg',
      crop: CROPS.tagline,
      title: 'Zenith Highest Story-Telling Press',
      fill: 'currentColor',
      component: 'apps/web/src/components/logo-tagline.tsx',
    },
  ];

  console.log('');
  for (const job of jobs) {
    const crop = await clampCrop(job.crop);
    const bitmap = await inkBitmap(crop);

    const svg = normalise(
      await trace(bitmap, {
        // Below this many pixels, a speck is noise from anti-aliasing rather
        // than part of the logo. The mark has no detail anywhere near this size.
        turdSize: 8,
        // Corner threshold. 1.0 is potrace's default and preserves the sharp
        // corners in the Z and the box while still smoothing the round bowls;
        // higher values round the corners off, which is visible on the box.
        alphaMax: 1.0,
        optCurve: true,
        optTolerance: 0.2,
        threshold: 128,
      }),
      job.title,
      job.fill,
    );

    const svgCompressed = compressPaths(svg);

    const outPath = join(OUT_DIR, job.name);
    writeFileSync(outPath, svgCompressed, 'utf8');

    /*
     * The inlined component is generated, not hand-copied.
     *
     * Inlining is what makes `currentColor` work, but a path pasted into a
     * .tsx by hand is a second copy that silently stops matching the artwork
     * the first time the logo is re-traced. Emitting it here keeps one source
     * of truth: the original PNG.
     */
    if (job.component) {
      /*
       * The exported name is derived from the filename rather than hardcoded.
       *
       * An earlier version wrote `export function LogoMark` into every
       * generated component. Adding a second one therefore produced
       * logo-tagline.tsx exporting `LogoMark` — the right artwork under the
       * wrong symbol, which fails at the import rather than where the mistake
       * is.
       */
      const componentName = (job.component.split('/').pop() ?? '')
        .replace(/\.tsx$/, '')
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');

      const path = /<path[^>]*\sd="([^"]+)"/.exec(svgCompressed)?.[1] ?? '';
      const viewBox = /viewBox="([^"]+)"/.exec(svgCompressed)?.[1] ?? '';
      writeFileSync(
        join(root, job.component),
        `// GENERATED by scripts/trace-logo-svg.mjs — do not edit by hand.\n` +
          `// Re-run: pnpm brand:svg\n\n` +
          `/**\n` +
          ` * ${job.title}, inlined so it inherits \`currentColor\`.\n` +
          ` *\n` +
          ` * Referencing the same artwork through <img src="/brand/${job.name}">\n` +
          ` * would render it at a fixed colour regardless of surrounding styles:\n` +
          ` * an SVG loaded that way is an isolated document and cannot see the\n` +
          ` * page's colour. Inlined, it takes the text colour of whatever it sits\n` +
          ` * in, so one component serves both light and dark grounds.\n` +
          ` */\n` +
          `export function ${componentName}({ className }: { className?: string }) {\n` +
          `  return (\n` +
          `    <svg\n` +
          `      viewBox="${viewBox}"\n` +
          `      fill="currentColor"\n` +
          `      aria-hidden="true"\n` +
          `      focusable="false"\n` +
          `      className={className}\n` +
          `    >\n` +
          `      <path\n        fillRule="evenodd"\n        d="${path}"\n      />\n` +
          `    </svg>\n` +
          `  );\n` +
          `}\n`,
        'utf8',
      );
    }

    const score = await fidelity(svgCompressed, crop);
    const svgKb = (statSync(outPath).size / 1024).toFixed(1);
    // Not every asset has a raster counterpart to compare against — the
    // tagline is SVG-only, since it exists purely to build the horizontal
    // header lockup.
    const pngPath = job.raster ? join(OUT_DIR, job.raster) : null;
    const pngKb =
      pngPath && existsSync(pngPath) ? (statSync(pngPath).size / 1024).toFixed(1) : '—';

    console.log(`  ${job.name}`);
    console.log(`    size        ${svgKb}KB  (raster equivalent ${pngKb}KB)`);
    console.log(
      `    fidelity    ${score.percentOfCanvas}% of pixels differ ` +
        `(${score.percentOfInk}% relative to inked area)`,
    );
    console.log(`    paths       ${(svg.match(/<path/g) ?? []).length}\n`);
  }

  console.log('  Reconstruction, not the original vector. Ask the designer for');
  console.log('  the source file if the press has it.\n');
}

await main();
