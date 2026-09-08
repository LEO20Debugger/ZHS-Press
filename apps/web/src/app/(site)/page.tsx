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
import { Reveal } from '@/components/reveal';
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
            <div className="rise">
              <Eyebrow>An independent press</Eyebrow>
            </div>
            <h1 className="rise mt-5 text-hero" style={{ '--rise-delay': '90ms' } as React.CSSProperties}>
              <em className="font-display italic">Books</em>, a magazine, and things to write
              in.
            </h1>
            <div className="rise" style={{ '--rise-delay': '260ms' } as React.CSSProperties}>
              <HandDrawnRule className="mt-6 max-w-[260px] text-terracotta" />
            </div>

            <p className="rise prose-editorial mt-6 text-ink-muted" style={{ '--rise-delay': '340ms' } as React.CSSProperties}>
              ZHS Press publishes picture books for young readers, the literary arts magazine{' '}
              <em>Light</em>, and journals with covers by the artists we work with. Everything we
              make is available here and on Amazon.
            </p>

            <div className="rise mt-8 flex flex-wrap gap-4" style={{ '--rise-delay': '440ms' } as React.CSSProperties}>
              <Button href="/shop">Visit the shop</Button>
              <Button href="/books" variant="outline">
                Our books
              </Button>
            </div>
          </div>

          {hero ? (
            <Link
              href={productHref(hero)}
              style={{ ...accentStyle(hero.accent), '--rise-delay': '200ms' } as React.CSSProperties}
              className="rise group block"
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
                <div className="sticker-settle absolute left-5 top-5">
                  {hero.status === 'coming_soon' ? (
                    <Sticker>Coming soon</Sticker>
                  ) : (
                    <Sticker>New</Sticker>
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
        <Reveal>
        <SectionHeading
          eyebrow="Books"
          title="Picture books for young readers"
          action={{ href: '/books', label: 'All books' }}
        />
        </Reveal>
        <Reveal delay={80}>
          <ProductGrid products={books.items} />
        </Reveal>
      </Section>

      {/*
        Light gets its own band and its own accent so it reads as a distinct
        publication — but it lives here, at zhspress.org, not on its own domain.
      */}
      <Section tone="paper">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <Reveal>
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
          </Reveal>
          <Reveal delay={100}>
            <ProductGrid products={issues.items} />
          </Reveal>
        </div>
      </Section>

      <Section tone="deep">
        <Reveal>
        <SectionHeading
          eyebrow="Stationery"
          title="Journals with artist covers"
          action={{ href: '/shop?category=stationery', label: 'All stationery' }}
        />
        </Reveal>
        <Reveal delay={80}>
          <ProductGrid products={stationery.items} />
        </Reveal>
      </Section>

      <Section tone="ink">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <Reveal>
            <h2 className="font-display text-display">We read every submission.</h2>
            <HandDrawnRule className="mt-4 max-w-[200px] text-sand" />
          </Reveal>
          <Reveal delay={100}>
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
          </Reveal>
        </div>
      </Section>
    </>
  );
}
