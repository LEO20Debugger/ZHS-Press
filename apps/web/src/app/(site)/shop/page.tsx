import type { Metadata } from 'next';
import Link from 'next/link';
import type { ProductType } from '@zhs/shared';
import { FilterDropdown } from '@/components/filter-dropdown';
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

  const sortHrefFor = (next: (typeof SORTS)[number]['value']) => {
    const query = new URLSearchParams();
    if (category) query.set('category', category);
    if (next !== 'newest') query.set('sort', next);
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
        {/*
          Two presentations of one set of controls.

          Below sm they are dropdowns: laid out flat, the pills wrap to two rows
          and the sort row to a third, which pinned 170px of a phone screen to
          filtering a nine-item catalogue. Above sm the width is there, and a
          row of pills you can read without opening anything is plainly better
          than one you have to.
        */}
        <div className="shell flex items-center justify-between gap-3 py-3 sm:hidden">
          <FilterDropdown
            label="Show"
            options={FILTERS.map((filter) => ({
              href: hrefFor(filter.value),
              label: filter.label,
              current: filter.value === category,
            }))}
          />
          <FilterDropdown
            label="Sort"
            align="right"
            options={SORTS.map((option) => ({
              href: sortHrefFor(option.value),
              label: option.label,
              current: option.value === sort,
            }))}
          />
        </div>

        <div className="shell hidden flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4 sm:flex">
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-caption text-ink-muted">{total} items</p>
            <nav aria-label="Sort" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {SORTS.map((option) => (
                <Link
                  key={option.value}
                  href={sortHrefFor(option.value)}
                  aria-current={option.value === sort ? 'true' : undefined}
                  className={`whitespace-nowrap py-1.5 text-caption ${
                    option.value === sort ? 'text-ink underline' : 'text-ink-muted'
                  }`}
                >
                  {option.label}
                </Link>
              ))}
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
