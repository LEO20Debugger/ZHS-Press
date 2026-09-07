import Image from 'next/image';
import Link from 'next/link';
import { formatMoney } from '@zhs/shared';
import { ProductGrid, productHref } from '@/components/product-card';
import {
  accentStyle,
  Button,
  Eyebrow,
  HandDrawnRule,
  Section,
  SectionHeading,
  Sticker,
} from '@/components/primitives';
import { listProducts } from '@/lib/catalog';

export default async function HomePage() {
  const [featured, books, issues, stationery] = await Promise.all([
    listProducts({ featured: true, perPage: 3 }),
    listProducts({ category: 'book', perPage: 4 }),
    listProducts({ category: 'magazine', perPage: 3 }),
    listProducts({ category: 'stationery', perPage: 4 }),
  ]);

  const hero = featured.items[0];

  return (
    <>
      {/*
        The brief is explicit that a first-time visitor must not have to search
        for what ZHS publishes. So the three things are named in the first
        sentence, above the fold, before any product.
      */}
      <section className="bg-paper pb-20 pt-16 md:pb-28 md:pt-24">
        <div className="shell grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <Eyebrow>An independent press</Eyebrow>
            <h1 className="mt-5 text-hero">
              <em className="font-display italic">Books</em>, a magazine, and things to write
              in.
            </h1>
            <HandDrawnRule className="mt-6 max-w-[260px] text-terracotta" />

            <p className="prose-editorial mt-6 text-ink-muted">
              ZHS Press publishes picture books for young readers, the literary arts magazine{' '}
              <em>Light</em>, and journals with covers by the artists we work with. Everything we
              make is available here and on Amazon.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button href="/shop">Visit the shop</Button>
              <Button href="/books" variant="outline">
                Our books
              </Button>
            </div>
          </div>

          {hero ? (
            <Link
              href={productHref(hero)}
              style={accentStyle(hero.accent)}
              className="group block"
            >
              <div className="cover-frame relative aspect-[4/5] bg-accent-tint">
                {hero.coverImage ? (
                  // The hero is the largest contentful paint; never lazy.
                  <Image
                    src={hero.coverImage.url}
                    alt={hero.coverImage.alt}
                    fill
                    sizes="(min-width: 1024px) 520px, 100vw"
                    priority
                    className="object-cover"
                  />
                ) : null}
                <div className="absolute left-5 top-5">
                  {hero.status === 'coming_soon' ? (
                    <Sticker tone="accent">Coming soon</Sticker>
                  ) : (
                    <Sticker tone="accent">New</Sticker>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="font-display text-h2">{hero.title}</h2>
                  {hero.attribution ? (
                    <p className="mt-1 text-small text-ink-muted">{hero.attribution}</p>
                  ) : null}
                </div>
                <p className="whitespace-nowrap text-small">
                  {hero.status === 'available'
                    ? formatMoney(hero.priceCents, hero.currency)
                    : 'Coming soon'}
                </p>
              </div>
            </Link>
          ) : null}
        </div>
      </section>

      <Section tone="deep">
        <SectionHeading
          eyebrow="Books"
          title="Picture books for young readers"
          action={{ href: '/books', label: 'All books' }}
        />
        <ProductGrid products={books.items} />
      </Section>

      {/*
        Light gets its own band and its own accent so it reads as a distinct
        publication — but it lives here, at zhspress.org, not on its own domain.
      */}
      <Section tone="paper">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <Eyebrow>The magazine</Eyebrow>
            <h2 className="mt-3 font-display text-display italic">Light</h2>
            <HandDrawnRule className="mt-4 max-w-[160px] text-ink-blue" />
            <p className="prose-editorial mt-5 text-ink-muted">
              A literary arts magazine about health, creativity and storytelling. Two themed issues
              a year, drawn from an open call. <em>Light</em> is published by ZHS Press.
            </p>
            <div className="mt-7">
              <Button href="/magazine" variant="outline">
                Read the archive
              </Button>
            </div>
          </div>
          <ProductGrid products={issues.items} />
        </div>
      </Section>

      <Section tone="deep">
        <SectionHeading
          eyebrow="Stationery"
          title="Journals with artist covers"
          action={{ href: '/shop?category=stationery', label: 'All stationery' }}
        />
        <ProductGrid products={stationery.items} />
      </Section>

      <Section tone="ink">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-display text-display">We read every submission.</h2>
            <HandDrawnRule className="mt-4 max-w-[200px] text-sand" />
          </div>
          <div>
            <p className="prose-editorial text-paper-deep">
              ZHS Press accepts manuscripts and pitches for fiction, non-fiction, children&rsquo;s
              books and literary work. You do not need an agent, and you do not need to have been
              published before.
            </p>
            <div className="mt-7">
              <Link
                href="/submissions"
                className="link-underline font-ui text-small uppercase tracking-wide"
              >
                How to submit →
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
