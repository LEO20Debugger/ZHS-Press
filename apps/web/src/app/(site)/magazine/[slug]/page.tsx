import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetailView } from '@/components/product-detail';
import { getProduct, listAllSlugs } from '@/lib/catalog';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await listAllSlugs();
  return slugs.filter((entry) => entry.type === 'magazine').map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: 'Not found' };

  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? product.blurb ?? undefined,
  };
}

export default async function IssuePage({ params }: Params) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || product.type !== 'magazine') notFound();

  return <ProductDetailView product={product} />;
}
