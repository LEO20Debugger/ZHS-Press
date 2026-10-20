import type { Metadata } from 'next';
import Link from 'next/link';
import { searchCatalog } from '@zhs/shared';
import { IconSearch } from '@/components/nav-icons';
import { ProductGrid } from '@/components/product-card';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';
import { listAllProducts } from '@/lib/catalog';

type SearchParams = Promise<{ q?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim();
  return {
    title: query ? `Search: ${query}` : 'Search',
    /*
     * Followed but not indexed. A results page is a view of pages that are
     * indexed already; letting every typed query become a page of its own in
     * search engines would fill them with thin near-duplicates of the shop.
     */
    robots: { index: false, follow: true },
  };
}

/**
 * Full search results — where Enter in the header search leads, and the page a
 * search link shares as.
 *
 * Uses the same matching as the header panel (searchCatalog), so the panel's
 * "See all 12 results" and this page always agree. The form is a plain GET, so
 * it works before JavaScript has loaded, and the query lives in the URL.
 */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const query = (q ?? '').trim().slice(0, 100);
  const results = query ? searchCatalog(await listAllProducts(), query) : [];

  return (
    <div className="shell py-16 md:py-20">
      <Eyebrow>Search</Eyebrow>
      <h1 className="mt-4 text-display">
        {query ? (
          <>
            Results for <em className="font-display italic">&ldquo;{query}&rdquo;</em>
          </>
        ) : (
          'Search the shop'
        )}
      </h1>
      <HandDrawnRule className="mt-5 max-w-[220px] text-terracotta" />

      <form action="/search" method="get" role="search" className="mt-8 max-w-xl">
        <label htmlFor="search-page-q" className="sr-only">
          Search
        </label>
        <div className="flex items-center gap-3 rounded-pill border border-rule bg-paper-raised px-5 focus-within:border-ink">
          <IconSearch size={20} className="text-ink-muted" />
          <input
            id="search-page-q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Title, author or subject"
            autoComplete="off"
            enterKeyHint="search"
            className="min-h-[52px] w-full bg-transparent font-ui text-body focus:outline-none"
          />
          <button type="submit" className="link-underline font-ui text-small">
            Search
          </button>
        </div>
      </form>

      <div className="mt-12">
        {!query ? (
          <p className="text-ink-muted">Type a title, an author&rsquo;s name, or what a book is about.</p>
        ) : results.length > 0 ? (
          <>
            <p className="mb-8 text-caption text-ink-muted">
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </p>
            <ProductGrid products={results} />
          </>
        ) : (
          <p className="text-ink-muted">
            Nothing found for &ldquo;{query}&rdquo;. Try an author&rsquo;s name, or{' '}
            <Link href="/shop" className="link-underline text-ink">
              browse everything in the shop
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
