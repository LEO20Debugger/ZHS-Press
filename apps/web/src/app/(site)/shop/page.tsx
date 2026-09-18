import type { Metadata } from 'next';
import Link from 'next/link';
import type { ProductType } from '@zhs/shared';
import { ProductGrid } from '@/components/product-card';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';
import { listProducts } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Books, LIGHT magazine issues, and stationery from ZHS Press. Worldwide delivery.',
};

const FILTERS = [
  { value: undefined, label: 'Everything' },
  { value: 'book', label: 'Books' },
  { value: 'magazine', label: 'Magazines' },
  { value: 'stationery', label: 'Stationery' },
] as const;

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price, low to high' },
  { value: 'price_desc', label: 'Price, high to low' },
  { value: 'title', label: 'A–Z' },
] as const;

type SearchParams = Promise<{ category?: string; sort?: string }>;

function isProductType(value: string | undefined): value is ProductType {
  return value === 'book' || value === 'magazine' || value === 'stationery';
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const category = isProductType(params.category) ? params.category : undefined;
  const sort = SORTS.find((option) => option.value === params.sort)?.value ?? 'newest';

  const { items, total } = await listProducts({ category, sort, perPage: 48 });

  /*
   * Filters are real links with real URLs, not client-side state. A filtered
   * view can be shared, bookmarked and indexed, it survives a page reload, and
   * it works before JavaScript has hydrated.
   */
  const hrefFor = (next: ProductType | undefined) => {
    const query = new URLSearchParams();
    if (next) query.set('category', next);
    if (sort !== 'newest') query.set('sort', sort);
    const queryString = query.toString();
    return queryString ? `/shop?${queryString}` : '/shop';
  };

  return (
    <>
      <div className="shell py-16 md:py-20">
        <Eyebrow>Shop</Eyebrow>
        <h1 className="mt-4 text-display">Everything we make, in one place.</h1>
        <HandDrawnRule className="mt-5 max-w-[220px] text-terracotta" />
        <p className="prose-editorial mt-5 text-ink-muted">
          Books, issues of <em>LIGHT</em>, and journals. Delivered worldwide.
        </p>
      </div>

      <div className="sticky top-[var(--header-height)] z-40 border-y border-rule bg-paper/95 backdrop-blur">
        <div className="shell flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
          <nav aria-label="Filter by category">
            <ul className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => {
                const active = filter.value === category;
                return (
                  <li key={filter.label}>
                    <Link
                      href={hrefFor(filter.value)}
                      aria-current={active ? 'page' : undefined}
                      className={`inline-block rounded-pill px-4 py-1.5 font-ui text-caption uppercase tracking-wide transition-colors duration-base ${
                        active
                          ? 'bg-ink text-paper'
                          : 'border border-rule text-ink-muted hover:border-ink hover:text-ink'
                      }`}
                    >
                      {filter.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/*
            The sort row, which at 375px was the one thing on the storefront
            that genuinely broke: five columns sharing the width left every
            label wrapping mid-phrase — "Price, low to" above "high" — and each
            link was bare text, well under a comfortable thumb target.

            Now the labels are unbreakable and the row wraps as whole items,
            so a sort reads as one phrase wherever it lands. Nothing is put in
            a horizontal scroller: an option that has to be swiped into view is
            an option most people never find.
          */}
          <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 sm:w-auto">
            <p className="text-caption text-ink-muted">{total} items</p>
            <nav aria-label="Sort" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {SORTS.map((option) => {
                const query = new URLSearchParams();
                if (category) query.set('category', category);
                if (option.value !== 'newest') query.set('sort', option.value);
                const queryString = query.toString();

                return (
                  <Link
                    key={option.value}
                    href={queryString ? `/shop?${queryString}` : '/shop'}
                    aria-current={option.value === sort ? 'true' : undefined}
                    className={`whitespace-nowrap py-1.5 text-caption ${
                      option.value === sort ? 'text-ink underline' : 'text-ink-muted'
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <div className="shell py-16">
        <ProductGrid products={items} emptyMessage="Nothing in this category yet." />
      </div>
    </>
  );
}
