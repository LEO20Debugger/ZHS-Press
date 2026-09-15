import type { Metadata } from 'next';
import Link from 'next/link';
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
        <h1 className="mt-4 max-w-3xl text-display">Books to read. Books to return to.</h1>
        <HandDrawnRule className="mt-6 max-w-[240px] text-terracotta" />

        <p className="prose-editorial mt-6 max-w-2xl text-ink-muted">
          From children&rsquo;s books to literary work, ZHS Press publishes books with character,
          curiosity, and something to say. Explore new releases and titles from our growing
          backlist.
        </p>

        {/*
          The arrow means a route change everywhere else on the site, so it
          goes somewhere: the same titles in the shop, where they can be
          sorted and filtered. This page stays the editorial front door.
        */}
        <p className="mt-6">
          <Link href="/shop?category=book" className="link-underline text-small font-medium">
            Browse all books →
          </Link>
        </p>
      </div>

      <div className="shell pb-24">
        <ProductGrid products={items} emptyMessage="No titles listed yet." />
      </div>
    </>
  );
}
