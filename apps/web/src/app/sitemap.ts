import type { MetadataRoute } from 'next';
import { listAllSlugs } from '@/lib/catalog';

const BASE = process.env.WEB_BASE_URL ?? 'https://zhspress.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ['', '/books', '/magazine', '/shop', '/submissions', '/about'].map(
    (route) => ({
      url: `${BASE}${route}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: route === '' ? 1 : 0.8,
    }),
  );

  const slugs = await listAllSlugs();
  const productRoutes = slugs.map(({ slug, type }) => {
    const prefix = type === 'book' ? '/books' : type === 'magazine' ? '/magazine' : '/shop';
    return {
      url: `${BASE}${prefix}/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    };
  });

  return [...staticRoutes, ...productRoutes];
}
