import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetailView } from '@/components/product-detail';
import { getProduct, listAllSlugs } from '@/lib/catalog';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await listAllSlugs();
  return slugs.filter((entry) => entry.type === 'book').map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: 'Not found' };

  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? product.blurb ?? undefined,
    openGraph: {
      title: product.title,
      description: product.blurb ?? undefined,
      images: product.coverImage ? [{ url: product.coverImage.url }] : undefined,
    },
  };
}

export default async function BookPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || product.type !== 'book') notFound();

  return (
    <>
      <ProductDetailView product={product} />
      {/*
        Structured data so the title is eligible for rich results. Price and
        availability mirror the same fields the shop uses, so they cannot drift.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: product.title,
            author: product.book?.authorName
              ? { '@type': 'Person', name: product.book.authorName }
              : undefined,
            isbn: product.book?.isbn ?? undefined,
            numberOfPages: product.book?.pageCount ?? undefined,
            description: product.blurb ?? undefined,
            offers: {
              '@type': 'Offer',
              price: (product.priceCents / 100).toFixed(2),
              priceCurrency: product.currency,
              availability:
                product.status === 'available'
                  ? 'https://schema.org/InStock'
                  : product.status === 'coming_soon'
                    ? 'https://schema.org/PreOrder'
                    : 'https://schema.org/OutOfStock',
            },
          }),
        }}
      />
    </>
  );
}
