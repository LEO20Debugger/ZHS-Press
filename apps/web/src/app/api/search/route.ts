import { NextResponse } from 'next/server';
import { listAllProducts } from '@/lib/catalog';

/** Rebuilt at most once a minute, the same window as the rest of the catalogue. */
export const revalidate = 60;

/**
 * The catalogue, trimmed to what the header search needs.
 *
 * Fetched once, the first time someone opens search, and searched in the
 * browser from then on — so typing never waits on the network. Only the
 * fields the results list shows or matches on are sent; the full product
 * records would be several times the size for nothing.
 */
export async function GET() {
  try {
    const items = await listAllProducts();
    return NextResponse.json(
      items.map((item) => ({
        id: item.id,
        slug: item.slug,
        type: item.type,
        status: item.status,
        title: item.title,
        subtitle: item.subtitle,
        attribution: item.attribution,
        // Matched on, never shown in results; a short slice is enough to find
        // a title by what it is about.
        blurb: item.blurb ? item.blurb.slice(0, 280) : null,
        priceCents: item.priceCents,
        currency: item.currency,
        coverImage: item.coverImage ? { url: item.coverImage.url, alt: item.coverImage.alt } : null,
      })),
    );
  } catch {
    // The panel says search is unavailable; the rest of the page is unaffected.
    return NextResponse.json({ message: 'Search is unavailable right now.' }, { status: 503 });
  }
}
