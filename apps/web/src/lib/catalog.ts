import type { Paginated, ProductDetail, ProductSummary, ProductType } from '@zhs/shared';
import { FIXTURE_PRODUCTS, FIXTURE_SUMMARIES } from './fixtures';

/**
 * Catalogue access for Server Components.
 *
 * Two modes, chosen explicitly rather than by accident:
 *
 * - USE_FIXTURES=true reads the design-time fixtures, so the storefront can be
 *   built and reviewed before the database exists.
 * - Otherwise every read goes to the API, and a failure throws. It does *not*
 *   fall back to fixtures — a storefront quietly serving invented products
 *   because the API was unreachable is far worse than an error page.
 */

const USE_FIXTURES = process.env.USE_FIXTURES === 'true';
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

/** Catalogue pages are static-ish; revalidate rather than refetch per request. */
const REVALIDATE_SECONDS = 60;

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    next: { revalidate: REVALIDATE_SECONDS, tags: ['catalog'] },
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`API ${response.status} for ${path}`);
  }

  return response.json() as Promise<T>;
}

export interface ListOptions {
  category?: ProductType;
  featured?: boolean;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'title';
  page?: number;
  perPage?: number;
}

function paginateFixtures(options: ListOptions): Paginated<ProductSummary> {
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 24;

  let items = FIXTURE_SUMMARIES.filter((item) =>
    options.category ? item.type === options.category : true,
  );
  if (options.featured != null) {
    items = items.filter((item) => item.featured === options.featured);
  }

  switch (options.sort) {
    case 'price_asc':
      items = [...items].sort((a, b) => a.priceCents - b.priceCents);
      break;
    case 'price_desc':
      items = [...items].sort((a, b) => b.priceCents - a.priceCents);
      break;
    case 'title':
      items = [...items].sort((a, b) => a.title.localeCompare(b.title));
      break;
    default:
      break;
  }

  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    page,
    perPage,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / perPage)),
  };
}

export async function listProducts(options: ListOptions = {}): Promise<Paginated<ProductSummary>> {
  if (USE_FIXTURES) return paginateFixtures(options);

  const params = new URLSearchParams();
  if (options.category) params.set('category', options.category);
  if (options.featured != null) params.set('featured', String(options.featured));
  if (options.sort) params.set('sort', options.sort);
  params.set('page', String(options.page ?? 1));
  params.set('perPage', String(options.perPage ?? 24));

  return apiGet<Paginated<ProductSummary>>(`/products?${params.toString()}`);
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  if (USE_FIXTURES) {
    return FIXTURE_PRODUCTS.find((product) => product.slug === slug) ?? null;
  }

  try {
    return await apiGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
  } catch {
    // A missing product is a 404 page, not a 500.
    return null;
  }
}

/**
 * The magazine archive. Every issue stays listed, sold out included — the
 * back catalogue is part of what makes Light worth subscribing to.
 */
export async function listIssues(): Promise<ProductSummary[]> {
  if (USE_FIXTURES) {
    return FIXTURE_SUMMARIES.filter((item) => item.type === 'magazine').sort((a, b) =>
      (b.attribution ?? '').localeCompare(a.attribution ?? '', undefined, { numeric: true }),
    );
  }

  return apiGet<ProductSummary[]>('/products/issues');
}

export async function listAllSlugs(): Promise<Array<{ slug: string; type: ProductType }>> {
  if (USE_FIXTURES) {
    return FIXTURE_SUMMARIES.map(({ slug, type }) => ({ slug, type }));
  }

  const { items } = await listProducts({ perPage: 60 });
  return items.map(({ slug, type }) => ({ slug, type }));
}
