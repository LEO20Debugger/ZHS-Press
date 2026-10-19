import type { ProductSummary } from '@zhs/shared';
import { getRelatedProducts } from '@/lib/catalog';
import { ProductGrid } from './product-card';
import { Section, SectionHeading } from './primitives';
import { Reveal } from './reveal';

/**
 * "You might also like", at the foot of every product page.
 *
 * Without it a product page is a dead end: the reader either buys or leaves.
 * Rendered nothing at all when there is nothing to suggest, rather than an
 * empty heading — a new shop with one title should not advertise the gap.
 */
export async function RelatedProducts({
  product,
}: {
  product: Pick<ProductSummary, 'id' | 'type' | 'attribution'>;
}) {
  const related = await getRelatedProducts(product);
  if (related.length === 0) return null;

  return (
    <Section tone="deep">
      <Reveal>
        <SectionHeading
          eyebrow="Keep browsing"
          title="You might also like"
          action={{ href: '/shop', label: 'See everything' }}
        />
      </Reveal>
      <ProductGrid products={related} />
    </Section>
  );
}
