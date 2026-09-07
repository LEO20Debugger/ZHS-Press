import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-card';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';
import { listProducts } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Books',
  description:
    'Picture books for young readers from ZHS Press, available here and on Amazon.',
};

export default async function BooksPage() {
  const { items } = await listProducts({ category: 'book', perPage: 48 });

  return (
    <>
      <div className="shell py-16 md:py-24">
        <Eyebrow>Books</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-display">
          Stories for readers who are still deciding what kind of reader they are.
        </h1>
        <HandDrawnRule className="mt-6 max-w-[240px] text-terracotta" />
      </div>

      <div className="shell pb-24">
        <ProductGrid products={items} emptyMessage="No titles listed yet." />
      </div>
    </>
  );
}
