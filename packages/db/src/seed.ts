import { randomBytes } from 'node:crypto';
import { hash as argonHash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { closeDb, createDb } from './client';
import { CATALOGUE } from './catalogue';
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
  for (const entry of CATALOGUE) {
    const existing = await db.query.products.findFirst({
      where: eq(schema.products.slug, entry.slug),
    });
    if (existing) {
      // Already seeded. Top up the cover if it is missing, which is the state
      // an earlier seed left the database in.
      const image = await db.query.productImages.findFirst({
        where: eq(schema.productImages.productId, existing.id),
      });
      if (!image) {
        await db.insert(schema.productImages).values({
          productId: existing.id,
          url: `/covers/${entry.cover}`,
          alt: `Cover artwork for ${entry.title}`,
          width: 896,
          height: 1200,
          position: 0,
        });
        console.log(`Added missing cover for ${entry.title}`);
      }
      continue;
    }

    const [inserted] = await db.insert(schema.products).values({
      slug: entry.slug,
      type: entry.type,
      status: entry.status,
      title: entry.title,
      subtitle: entry.subtitle ?? null,
      blurb: entry.blurb ?? null,
      description: entry.description ?? null,
      priceCents: entry.priceCents,
      currency: 'USD',
      accentHex: entry.accentHex,
      accentTintHex: entry.accentTintHex,
      releaseDate: entry.releaseDate ?? null,
      amazonUrl: entry.amazonUrl ?? null,
      featured: entry.featured ?? false,
    });

    const id = Number((inserted as unknown as { insertId: number }).insertId);

    // The cover. Without this row the storefront renders an empty tinted
    // frame — the product exists but has nothing to show.
    await db.insert(schema.productImages).values({
      productId: id,
      url: `/covers/${entry.cover}`,
      alt: `Cover artwork for ${entry.title}`,
      width: 896,
      height: 1200,
      position: 0,
    });

    if (entry.book) await db.insert(schema.bookDetails).values({ productId: id, ...entry.book });
    if (entry.issue)
      await db.insert(schema.magazineIssues).values({ productId: id, ...entry.issue });
    if (entry.stationery)
      await db.insert(schema.stationeryDetails).values({ productId: id, ...entry.stationery });

    await db.insert(schema.inventory).values({ productId: id, quantity: entry.quantity });
    console.log(`Seeded ${entry.title}`);
  }

  await closeDb();
  console.log('\nSeed complete.');
}

main().catch(async (error: unknown) => {
  console.error('Seed failed:', error);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
