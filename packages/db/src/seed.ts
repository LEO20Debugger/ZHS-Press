import { randomBytes } from 'node:crypto';
import { hash as argonHash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { closeDb, createDb } from './client';
import * as schema from './schema/index';

/**
 * Seeds a usable database: one admin account, shipping zones, and the current
 * catalogue.
 *
 * Idempotent — safe to re-run. Existing rows are left alone rather than
 * duplicated, so this can be used to top up a database that is already partly
 * populated.
 *
 * The admin password is generated and printed once. It is never written to a
 * file and never committed.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  const db = createDb({ url });

  /* ---- Admin account --------------------------------------------------- */
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@zhspress.org';
  const existingAdmin = await db.query.adminUsers.findFirst({
    where: eq(schema.adminUsers.email, adminEmail),
  });

  if (existingAdmin) {
    console.log(`Admin ${adminEmail} already exists — leaving it alone.`);
  } else {
    const password = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');
    await db.insert(schema.adminUsers).values({
      email: adminEmail,
      name: 'ZHS Press Admin',
      passwordHash: await argonHash(password),
      role: 'admin',
    });

    console.log('\n  Admin account created');
    console.log(`  email:    ${adminEmail}`);
    console.log(`  password: ${password}`);
    console.log('  Save this now — it is not stored anywhere and will not be shown again.\n');
  }

  /* ---- Shipping zones --------------------------------------------------
   * Flat rate per zone is the launch implementation; fulfilment is still TBC
   * in the brief, so these are placeholders for the Director to confirm.
   */
  const existingRates = await db.query.shippingRates.findMany();
  if (existingRates.length === 0) {
    await db.insert(schema.shippingRates).values([
      {
        zoneName: 'United States',
        countryCodes: ['US'],
        rateCents: 499,
        freeOverCents: 3500,
        isDefault: false,
      },
      {
        zoneName: 'United Kingdom & Ireland',
        countryCodes: ['GB', 'IE'],
        rateCents: 699,
        freeOverCents: 5000,
        isDefault: false,
      },
      {
        zoneName: 'Rest of world',
        countryCodes: [],
        rateCents: 1299,
        freeOverCents: 8000,
        isDefault: true,
      },
    ]);
    console.log('Seeded 3 shipping zones (placeholder rates — confirm before launch).');
  }

  /* ---- Catalogue -------------------------------------------------------- */
  const catalogue = [
    {
      slug: 'soar',
      type: 'book' as const,
      status: 'available' as const,
      title: 'Soar',
      subtitle: 'A story about finding your own height',
      blurb:
        'Two siblings, one impossible hill, and an afternoon that turns into the summer they will tell stories about for years.',
      priceCents: 1499,
      accentHex: '#b13f2f',
      accentTintHex: '#f0e2d8',
      releaseDate: '2025-06-03',
      featured: true,
      book: { authorName: 'Zainab H. Suleiman', format: 'Hardcover', pageCount: 40 },
      quantity: 40,
    },
    {
      slug: 'turnaspurn',
      type: 'book' as const,
      status: 'coming_soon' as const,
      title: 'TurnaSpurn',
      subtitle: 'A tale told backwards, then forwards again',
      blurb:
        'A word that means nothing until you say it twice. A village that only appears to those willing to walk home the long way.',
      priceCents: 1699,
      accentHex: '#5a6b4e',
      accentTintHex: '#e9e9e2',
      releaseDate: '2025-09-16',
      featured: true,
      book: { authorName: 'Ekene Adeyemi', format: 'Hardcover', pageCount: 56 },
      quantity: 0,
    },
    {
      slug: 'light-issue-4',
      type: 'magazine' as const,
      status: 'available' as const,
      title: 'Light, Issue Four',
      subtitle: 'Inheritance',
      blurb: 'Twenty-two writers and artists on what gets handed down that nobody chose.',
      priceCents: 1200,
      accentHex: '#2f4b7c',
      accentTintHex: '#e2e2e4',
      releaseDate: '2025-07-01',
      featured: true,
      issue: { issueNumber: 4, theme: 'Inheritance' },
      quantity: 120,
    },
    {
      slug: 'journal-marigold',
      type: 'stationery' as const,
      status: 'available' as const,
      title: 'The Marigold Journal',
      subtitle: 'Lined, 160 pages',
      blurb: 'A lay-flat notebook with an artist-designed cover.',
      priceCents: 2450,
      accentHex: '#e0a02e',
      accentTintHex: '#faf1de',
      featured: false,
      stationery: { dimensions: '148 x 210 mm (A5)', pageCount: 160, coverArtist: 'Ify Okonkwo' },
      quantity: 60,
    },
  ];

  for (const entry of catalogue) {
    const existing = await db.query.products.findFirst({
      where: eq(schema.products.slug, entry.slug),
    });
    if (existing) continue;

    const [inserted] = await db.insert(schema.products).values({
      slug: entry.slug,
      type: entry.type,
      status: entry.status,
      title: entry.title,
      subtitle: entry.subtitle,
      blurb: entry.blurb,
      priceCents: entry.priceCents,
      currency: 'USD',
      accentHex: entry.accentHex,
      accentTintHex: entry.accentTintHex,
      releaseDate: entry.releaseDate ?? null,
      featured: entry.featured,
    });

    const id = Number((inserted as unknown as { insertId: number }).insertId);

    if (entry.book) await db.insert(schema.bookDetails).values({ productId: id, ...entry.book });
    if (entry.issue)
      await db.insert(schema.magazineIssues).values({ productId: id, ...entry.issue });
    if (entry.stationery)
      await db.insert(schema.stationeryDetails).values({ productId: id, ...entry.stationery });

    await db.insert(schema.inventory).values({ productId: id, quantity: entry.quantity });
    console.log(`Seeded product: ${entry.title}`);
  }

  await closeDb();
  console.log('\nSeed complete.');
}

main().catch(async (error: unknown) => {
  console.error('Seed failed:', error);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
