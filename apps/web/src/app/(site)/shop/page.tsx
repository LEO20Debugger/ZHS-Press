import type { Metadata } from 'next';
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
          One set of controls at every width: Show on the left, the count and
          Sort on the right — the same pair of dropdowns, so choosing a category
          and choosing an order work alike.

          On a phone they split the row into two equal halves and the count
          steps aside; the selected option is written on each trigger, so what
          is being shown is still readable without opening anything.
        */}
        <div className="shell grid grid-cols-2 gap-2 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <FilterDropdown
            label="Show"
            options={FILTERS.map((filter) => ({
              href: hrefFor(filter.value),
              label: filter.label,
              current: filter.value === category,
              icon: <filter.Icon size={16} />,
            }))}
          />

          <div className="flex min-w-0 items-center justify-end gap-4">
            <p className="hidden whitespace-nowrap text-caption text-ink-muted sm:block">
              {total} {total === 1 ? 'item' : 'items'}
            </p>
            <div className="min-w-0 flex-1 sm:flex-none">
              <FilterDropdown
                label="Sort"
                align="right"
                icon={<IconSort size={16} />}
                options={sortOptions}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="shell py-16">
        <ProductGrid products={items} emptyMessage="Nothing in this category yet." />
      </div>
    </>
  );
}
