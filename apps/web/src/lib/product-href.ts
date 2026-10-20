import type { ProductSummary } from '@zhs/shared';

/** Books, issues and stationery each live under their own section of the site. */
export function productHref(product: Pick<ProductSummary, 'slug' | 'type'>): string {
  switch (product.type) {
    case 'book':
      return `/books/${product.slug}`;
    case 'magazine':
      return `/magazine/${product.slug}`;
    default:
      return `/shop/${product.slug}`;
  }
}
