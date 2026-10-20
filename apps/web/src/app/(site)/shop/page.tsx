import type { Metadata } from 'next';
import Link from 'next/link';
import type { ProductType } from '@zhs/shared';
import { FilterDropdown } from '@/components/filter-dropdown';
import { IconBooks, IconGrid, IconMagazine, IconSort, IconStationery } from '@/components/nav-icons';
import { ProductGrid } from '@/components/product-card';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';
import { listProducts } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Books, LIGHT magazine issues, and stationery from ZHS Press. Worldwide delivery.',
};

/*
 * Each category carries an icon beside its name, never instead of it: a
 * glyph alone cannot tell a magazine from a book at a glance, and a filter you
 * have to guess at is slower than one you can read.
 */
const FILTERS = [
  { value: undefined, label: 'Everything', Icon: IconGrid },
  { value: 'book', label: 'Books', Icon: IconBooks },
  { value: 'magazine', label: 'Magazines', Icon: IconMagazine },
  { value: 'stationery', label: 'Stationery', Icon: IconStationery },
] as const;

const SORTS = [
  { value: 'newest', label: 'Newest', short: 'Newest' },
  { value: 'price_asc', label: 'Lowest price', short: 'Low price' },
  { value: 'price_desc', label: 'Highest price', short: 'High price' },
  { value: 'title', label: 'A–Z', short: 'A–Z' },
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

  const sortOptions = SORTS.map((option) => ({
    href: sortHrefFor(option.value),
    label: option.label,
    shortLabel: option.short,
    current: option.value === sort,
  }));

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

      <div className="bar-frosted sticky-under-header sticky z-40 border-y border-rule">
        {/*
          Two presentations of one set of controls.

          Below sm they are dropdowns: laid out flat, the pills wrap to two rows
          and the sort row to a third, which pinned 170px of a phone screen to
          filtering a nine-item catalogue. Above sm the width is there, and a
          row of pills you can read without opening anything is plainly better
          than one you have to.
        */}
        <div className="shell grid grid-cols-2 gap-2 py-3 sm:hidden">
          <FilterDropdown
            label="Show"
            options={FILTERS.map((filter) => ({
              href: hrefFor(filter.value),
              label: filter.label,
              current: filter.value === category,
              icon: <filter.Icon size={16} />,
            }))}
          />
          <FilterDropdown
            label="Sort"
            align="right"
            icon={<IconSort size={16} />}
            options={sortOptions}
          />
        </div>

        <div className="shell hidden items-center justify-between gap-4 py-3 sm:flex">
          {/*
            One row at every width. Between tablet and desktop the four chips
            and the sort control do not quite fit side by side; wrapping them
            doubled the height of a bar that stays on screen the whole visit.
            The chips scroll sideways instead, and Sort stays put.
          */}
          <nav aria-label="Filter by category" className="-my-1 min-w-0 py-1">
            <ul className="no-scrollbar flex gap-2 overflow-x-auto pr-8 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] lg:pr-0 lg:[mask-image:none]">
              {FILTERS.map((filter) => {
                const active = filter.value === category;
                return (
                  <li key={filter.label} className="shrink-0">
                    <Link
                      href={hrefFor(filter.value)}
                      aria-current={active ? 'page' : undefined}
                      className={`inline-flex items-center gap-2 rounded-pill py-2 pl-3.5 pr-4 font-ui text-small transition-colors duration-base ${
                        active
                          ? 'bg-ink text-paper'
                          : 'border border-rule text-ink-muted hover:border-ink hover:text-ink'
                      }`}
                    >
                      <filter.Icon size={16} />
                      {filter.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/*
            Sort is one control rather than four links: the choice is made
            rarely, and laid out flat it took half the bar and competed with the
            categories for attention. The count sits beside it, so the result of
            a filter is readable without scrolling.
          */}
          <div className="flex shrink-0 items-center gap-4">
            <p className="whitespace-nowrap text-caption text-ink-muted">
              {total} {total === 1 ? 'item' : 'items'}
            </p>
            <FilterDropdown
              label="Sort"
              align="right"
              icon={<IconSort size={16} />}
              options={sortOptions}
            />
          </div>
        </div>
      </div>

      <div className="shell py-16">
        <ProductGrid products={items} emptyMessage="Nothing in this category yet." />
      </div>
    </>
  );
}
