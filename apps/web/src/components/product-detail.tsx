import Image from 'next/image';
import { formatMoney } from '@zhs/shared';
import type { ProductDetail } from '@zhs/shared';
import { AddToCart } from './add-to-cart';
import { accentStyle, Button, Eyebrow, HandDrawnRule, Sticker } from './primitives';
import { Reveal } from './reveal';
import { WaitlistForm } from './waitlist-form';

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-6 border-b border-rule py-2.5">
      <dt className="text-small text-ink-muted">{label}</dt>
      <dd className="text-right text-small">{value}</dd>
    </div>
  );
}

/**
 * Buy actions.
 *
 * The brief requires both routes on every book: the ZHS shop and the Amazon
 * listing (2.2). The shop is the primary action — that is the checkout we
 * control and the one that keeps the margin — with Amazon offered plainly
 * rather than hidden.
 */
function BuyActions({ product }: { product: ProductDetail }) {
  if (product.status === 'coming_soon') {
    return (
      <div>
        <p className="text-small text-ink-muted">
          Out {formatReleaseDate(product.releaseDate)}. We will email you once, on the day it is
          available.
        </p>
        <div className="mt-4 max-w-sm">
          <WaitlistForm productId={product.id} title={product.title} />
        </div>
      </div>
    );
  }

  if (product.status === 'sold_out') {
    return (
      <div>
        <p className="text-small text-ink-muted">
          This issue is sold out in print. It stays here so the archive is complete.
        </p>
        {product.amazonUrl ? (
          <div className="mt-4">
            <Button href={product.amazonUrl} variant="outline">
              Check on Amazon
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <AddToCart productId={product.id} title={product.title} />
      {product.amazonUrl ? (
        <Button href={product.amazonUrl} variant="outline">
          Buy on Amazon
        </Button>
      ) : null}
    </div>
  );
}

function formatReleaseDate(date: string | null): string {
  if (!date) return 'soon';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'soon';
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function ProductDetailView({ product }: { product: ProductDetail }) {
  const cover = product.images[0] ?? product.coverImage;

  return (
    <article style={accentStyle(product.accent)}>
      {/*
        The title's accent becomes the ground for the whole top of the page.
        This is the per-title colour doing its job: two books never look like
        the same template with different words in it.
      */}
      <div className="bg-accent-tint pb-16 pt-12 md:pb-24 md:pt-16">
        <div className="shell grid gap-12 md:grid-cols-2 md:gap-16">
          <div className="cover-frame rise group relative mx-auto w-full max-w-md bg-paper-raised">
            {cover ? (
              // The largest contentful paint on this page: priority, never lazy.
              <Image
                src={cover.url}
                alt={cover.alt}
                width={cover.width ?? 896}
                height={cover.height ?? 1200}
                sizes="(min-width: 768px) 448px, 100vw"
                priority
                className="h-full w-full object-cover"
              />
            ) : null}
            {product.status !== 'available' ? (
              <div className="sticker-settle absolute left-4 top-4">
                <Sticker tone={product.status === 'sold_out' ? 'quiet' : 'ink'}>
                  {product.status === 'sold_out' ? 'Sold out' : 'Coming soon'}
                </Sticker>
              </div>
            ) : null}
          </div>

          <div
            className="rise flex flex-col justify-center"
            style={{ '--rise-delay': '140ms' } as React.CSSProperties}
          >
            <Eyebrow>{typeLabel(product)}</Eyebrow>
            <h1 className="mt-4 text-display">{product.title}</h1>
            {product.subtitle ? (
              <p className="mt-2 font-editorial text-h3 italic text-ink-muted">
                {product.subtitle}
              </p>
            ) : null}

            <HandDrawnRule className="mt-5 max-w-[200px] text-accent" />

            {product.attribution ? (
              <p className="mt-5 text-small">{product.attribution}</p>
            ) : null}

            {product.blurb ? (
              <p className="prose-editorial mt-5">{product.blurb}</p>
            ) : null}

            {product.status === 'available' ? (
              <p className="mt-7 font-display text-h2">
                {formatMoney(product.priceCents, product.currency)}
              </p>
            ) : null}

            <div className="mt-7">
              <BuyActions product={product} />
            </div>
          </div>
        </div>
      </div>

      <div className="shell grid gap-16 py-16 md:grid-cols-[1.4fr_1fr] md:py-24">
        <Reveal>
          {product.description ? (
            <>
              <h2 className="font-display text-h2">About this {typeNoun(product)}</h2>
              <div className="prose-editorial mt-5">
                {product.description.split('\n\n').map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            </>
          ) : null}

          {product.issue?.editorNote ? (
            <div className="mt-12">
              <h2 className="font-display text-h2">From the editor</h2>
              <blockquote className="prose-editorial mt-5 border-l-2 border-accent pl-6 italic">
                {product.issue.editorNote}
              </blockquote>
            </div>
          ) : null}

          {product.issue && product.issue.contributors.length > 0 ? (
            <div className="mt-12">
              <h2 className="font-display text-h2">In this issue</h2>
              <ul className="mt-5 divide-y divide-rule">
                {product.issue.contributors.map((contributor) => (
                  <li key={contributor.slug} className="flex justify-between gap-6 py-3">
                    <span className="text-small">{contributor.name}</span>
                    {contributor.pieceTitle ? (
                      <span className="text-right font-editorial text-small italic text-ink-muted">
                        {contributor.pieceTitle}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Reveal>

        <Reveal as="aside" delay={90}>
          <h2 className="eyebrow">Details</h2>
          <dl className="mt-4">
            {product.book ? (
              <>
                <DetailRow label="Author" value={product.book.authorName} />
                <DetailRow label="Illustrator" value={product.book.illustratorName} />
                <DetailRow label="Format" value={product.book.format} />
                <DetailRow label="Pages" value={product.book.pageCount} />
                <DetailRow label="Reading age" value={product.book.ageRange} />
                <DetailRow label="ISBN" value={product.book.isbn} />
              </>
            ) : null}

            {product.issue ? (
              <>
                <DetailRow label="Issue" value={product.issue.issueNumber} />
                <DetailRow label="Theme" value={product.issue.theme} />
                <DetailRow label="Published" value={formatReleaseDate(product.issue.publishedDate)} />
              </>
            ) : null}

            {product.stationery ? (
              <>
                <DetailRow label="Size" value={product.stationery.dimensions} />
                <DetailRow label="Material" value={product.stationery.material} />
                <DetailRow label="Pages" value={product.stationery.pageCount} />
                <DetailRow label="Cover artist" value={product.stationery.coverArtist} />
              </>
            ) : null}
          </dl>

          <p className="mt-8 text-caption text-ink-muted">
            Shipping is calculated at checkout. Worldwide delivery.
          </p>
        </Reveal>
      </div>
    </article>
  );
}

function typeLabel(product: ProductDetail): string {
  switch (product.type) {
    case 'book':
      return 'Book';
    case 'magazine':
      return 'Light magazine';
    default:
      return 'Stationery';
  }
}

function typeNoun(product: ProductDetail): string {
  switch (product.type) {
    case 'book':
      return 'book';
    case 'magazine':
      return 'issue';
    default:
      return 'journal';
  }
}
