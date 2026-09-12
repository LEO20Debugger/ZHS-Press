#!/usr/bin/env node
/**
 * Derives the site's brand assets from the supplied logo artwork.
 *
 *   pnpm brand:build
 *
 * The source file (design/zhs-logo.png) is a single 7371x3457 canvas holding *two*
 * colourways side by side — black at the top right for light grounds, white at
 * the bottom left for dark ones. The white copy is invisible when the file is
 * previewed on a white background, which is a good way to not notice it exists.
 *
 * Rather than hand-cropping, the crop boxes below were measured from the alpha
 * channel: the two copies are separated by splitting the canvas in half, and
 * within each copy the boxed ZHS mark is separated from the tagline by finding
 * the blank band of rows between them.
 *
 * Two assets come out of each colourway, because they are not interchangeable:
 *
 * - **mark** — the boxed ZHS alone. Used anywhere the logo is small. At the
 *   40px header height the tagline would render about 4px tall, which is
 *   illegible and reads as dirt rather than words.
 * - **lockup** — mark plus "Zenith Highest Story-Telling Press". Used where
 *   there is room to read it, so the full name appears somewhere on every page.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = join(root, 'design/zhs-logo.png');

/*
 * The brand black is #000000 and the ground it sits on is #faf7f0, and the one
 * rule this design system is built on is that neither pure black nor pure white
 * appears anywhere (scripts/check-raw-colors.mjs enforces it in code).
 *
 * So the mark is tinted to --ink and --paper-raised, the same values every
 * other element uses. The shift is about 3% and is not perceptible beside the
 * original; what it avoids is a logo that reads very slightly colder than the
 * type sitting next to it, which is perceptible once you see it.
 *
 * If the press would rather keep it strictly #000000, change INK below — the
 * colour-check script exempts generated assets.
 */
const INK = { r: 0x1e, g: 0x25, b: 0x25 }; // --ink
const PAPER_RAISED = { r: 0xff, g: 0xfe, b: 0xfa }; // --paper-raised
const PAPER = { r: 0xfa, g: 0xf7, b: 0xf0 }; // --paper

/**
 * Keeps a crop inside the canvas.
 *
 * The boxes below were measured with a few pixels of padding added around the
 * ink, which pushes the right-hand copy past the edge of the source by 10px.
 * sharp rejects that outright ("bad extract area") rather than clamping, so it
 * is clamped here — and doing it at use time means the measured numbers can
 * stay as measured rather than being silently pre-shrunk.
 */
async function clamp(crop) {
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

/** Measured from the alpha channel — see the header comment. */
const CROPS = {
  darkMark: { left: 4179, top: 0, width: 3202, height: 1494 },
  darkLockup: { left: 4179, top: 0, width: 3202, height: 2250 },
  lightMark: { left: 0, top: 1212, width: 3202, height: 1500 },
  lightLockup: { left: 0, top: 1212, width: 3202, height: 2256 },
};

/**
 * Recolours a monochrome, transparent source.
 *
 * The artwork's own RGB is discarded and only its alpha is kept, then used as
 * the alpha of a flat colour. That gives an exact tint with the original
 * anti-aliasing intact — trying to remap the RGB instead leaves grey fringes
 * wherever the edges were blended against the old colour.
 */
async function tinted(rawCrop, width, colour, outPath, { background = null } = {}) {
  const crop = await clamp(rawCrop);
  const meta = { width, height: Math.round((width * crop.height) / crop.width) };

  const alpha = await sharp(SOURCE)
    .extract(crop)
    .resize(meta.width, meta.height, { fit: 'fill' })
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer();

  const pipeline = sharp({
    create: {
      width: meta.width,
      height: meta.height,
      channels: 3,
      background: colour,
    },
  }).joinChannel(alpha, { raw: { width: meta.width, height: meta.height, channels: 1 } });

  /*
   * `flatten` composites the ink onto a solid ground, and `removeAlpha` drops
   * the channel afterwards — flatten alone leaves a fully-opaque alpha channel
   * in place, which a palette PNG happily preserves. The email asset must have
   * no transparency at all, so a client that inverts backgrounds cannot show
   * dark ink on its own dark ground.
   */
  await (background ? pipeline.flatten({ background }).removeAlpha() : pipeline)
    .png({ compressionLevel: 9, palette: true })
    .toFile(outPath);

  return meta;
}

/**
 * A square icon.
 *
 * The mark is 2.14:1, so it is padded rather than stretched — but *how much*
 * padding matters far more than it looks, because the mark is scaled to `fill`
 * of the square's **width** and its height then follows the aspect ratio.
 * At fill 0.76 the glyph ends up only 33% as tall as the square, which is
 * roughly 5px in a 16px browser tab: technically present, practically a smudge.
 *
 * A 2.14:1 mark can never exceed about 47% of a square's height, so the only
 * lever is using the full width. The favicon therefore fills almost edge to
 * edge, while the Apple touch icon keeps its padding: iOS rounds the corners
 * and applies its own mask, so a full-bleed glyph gets clipped there.
 *
 * `flatten` is applied for the Apple icon because iOS composites transparent
 * icons onto black, which would put the ink on near-black.
 */
async function icon(rawCrop, size, colour, background, outPath, { opaque = false, fill = 0.76 } = {}) {
  const crop = await clamp(rawCrop);
  const inner = Math.round(size * fill);
  const height = Math.round((inner * crop.height) / crop.width);

  const alpha = await sharp(SOURCE)
    .extract(crop)
    .resize(inner, height, { fit: 'fill' })
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer();

  const mark = await sharp({
    create: { width: inner, height, channels: 3, background: colour },
  })
    .joinChannel(alpha, { raw: { width: inner, height, channels: 1 } })
    .png()
    .toBuffer();

  let canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: opaque ? { ...background, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: mark, gravity: 'centre' }]);

  if (opaque) canvas = canvas.flatten({ background });

  await canvas.png({ compressionLevel: 9 }).toFile(outPath);
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`\n  Source artwork not found: ${SOURCE}\n`);
    process.exit(1);
  }

  const brandDir = join(root, 'apps/web/public/brand');
  const appDir = join(root, 'apps/web/src/app');
  mkdirSync(brandDir, { recursive: true });

  const made = [];

  // 3x the rendered size, so the mark stays crisp on a high-density screen.
  made.push(['logo-mark.png', await tinted(CROPS.darkMark, 260, INK, join(brandDir, 'logo-mark.png'))]);
  made.push([
    'logo-mark-light.png',
    await tinted(CROPS.lightMark, 260, PAPER_RAISED, join(brandDir, 'logo-mark-light.png')),
  ]);
  made.push([
    'logo-lockup.png',
    await tinted(CROPS.darkLockup, 640, INK, join(brandDir, 'logo-lockup.png')),
  ]);
  made.push([
    'logo-lockup-light.png',
    await tinted(CROPS.lightLockup, 640, PAPER_RAISED, join(brandDir, 'logo-lockup-light.png')),
  ]);

  /*
   * A dedicated email logo, with the card's background baked in.
   *
   * Everything else here is transparent, which is right on the web. In email it
   * is a trap: Gmail and Outlook.com both invert backgrounds in dark mode, and
   * an --ink logo on a now-dark ground is invisible. Baking --paper-raised in
   * means the worst case is a light tile in a dark message — visibly a logo,
   * rather than a blank space.
   *
   * PNG, not SVG: no major mail client renders SVG. It is served at 2x the
   * rendered width so it stays sharp on a phone.
   */
  made.push([
    'logo-email.png',
    await tinted(CROPS.darkLockup, 264, INK, join(brandDir, 'logo-email.png'), {
      background: PAPER_RAISED,
    }),
  ]);

  /*
   * Two favicons, not one, and the small one is the point.
   *
   * With only the 512px file, a browser drawing a 16px tab icon downscales by
   * 32:1 through a generic filter, and the box outline — a hairline at that
   * scale — turns to grey mush. Offering a 32px asset lets it pick that
   * instead and halve once, which is visibly crisper on a standard-density
   * screen. The 512px file still serves high-DPI tabs, bookmarks and the
   * address bar.
   *
   * Next's App Router emits a <link> for each of icon.png / icon1.png with the
   * right `sizes`, and the browser chooses.
   */
  await icon(CROPS.darkMark, 512, INK, PAPER, join(appDir, 'icon.png'), { fill: 0.96 });
  await icon(CROPS.darkMark, 32, INK, PAPER, join(appDir, 'icon1.png'), { fill: 0.96 });
  await icon(CROPS.darkMark, 180, INK, PAPER, join(appDir, 'apple-icon.png'), {
    opaque: true,
    fill: 0.78,
  });

  console.log('\n  Brand assets written:\n');
  for (const [name, meta] of made) {
    console.log(`    apps/web/public/brand/${name.padEnd(24)} ${meta.width}x${meta.height}`);
  }
  console.log(`    apps/web/src/app/icon.png${' '.repeat(16)} 512x512 (transparent)`);
  console.log(`    apps/web/src/app/icon1.png${' '.repeat(15)} 32x32 (crisp tab size)`);
  console.log(`    apps/web/src/app/apple-icon.png${' '.repeat(10)} 180x180 (on --paper)\n`);
}

await main();
