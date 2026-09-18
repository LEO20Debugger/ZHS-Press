import Image from 'next/image';
import Link from 'next/link';
import { formatMoney } from '@zhs/shared';
import type { ProductSummary } from '@zhs/shared';
import { accentStyle, Sticker } from './primitives';
import { QuickAdd } from './add-to-cart';
import { Reveal } from './reveal';

/** Books, issues and stationery all live at the same URL shape as the shop. */
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

/** The card's view cue names what it opens, so the shop grid doesn't call a journal a book. */
const VIEW_LABELS: Partial<Record<ProductSummary['type'], string>> = {
  book: 'View book',
  magazine: 'View issue',
};

/**
 * The one sticker a cover carries.
 *
 * Status wins over stock, and they cannot collide anyway: only an `available`
 * title reaches the low-stock case, and a sold-out one is already labelled by
 * its status. The count is left off here on purpose — a grid of cards each
 * claiming an exact figure invites the reader to compare them, and the number
 * is only worth stating at the point of deciding, on the product page itself.
 */
function StatusSticker({ product }: { product: ProductSummary }) {
  switch (product.status) {
    case 'coming_soon':
      return <Sticker>Coming soon</Sticker>;
    case 'sold_out':
      return <Sticker tone="quiet">Sold out</Sticker>;
    default:
      return product.purchasable && product.stockLevel === 'low' ? (
        <Sticker tone="accent">Only a few left</Sticker>
      ) : null;
  }
}

/**
 * The product card.
 *
 * No border and no shadow — a shadow introduces a grey that is not in the
 * palette and instantly reads as generic. Separation comes from the cover
 * sitting on its own accent tint instead.
 */
export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    /*
      Not a <Link> wrapping the card. A button inside a link is invalid HTML and
      traps keyboard and screen reader users in nested interactives.
      Instead the title link stretches over the whole card via ::after, and the
      add button sits above it as a sibling — two separate controls, each
      reachable by tab, with the card still clickable anywhere.
    */
    <div
      style={accentStyle(product.accent)}
      className="group relative flex h-full flex-col"
    >
      <div className="cover-mount bg-accent-tint">
        {product.coverImage ? (
          /*
            sizes tells the browser how wide this will actually render, so it
            downloads a 300px file on a phone rather than the full cover. The
            grid is 2 columns on mobile, 3 at md, 4 at lg within a 1280 shell.
          */
          <Image
            src={product.coverImage.url}
            alt={product.coverImage.alt}
            width={product.coverImage.width ?? 896}
            height={product.coverImage.height ?? 1200}
            sizes="(min-width: 1024px) 300px, (min-width: 768px) 33vw, 50vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-h3 italic text-ink-muted">
            {product.title}
          </div>
        )}

        <div className="sticker-settle absolute left-3 top-3">
          <StatusSticker product={product} />
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <h3 className="text-h3 font-display">
          <Link
            href={productHref(product)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4"
          >
            {product.title}
          </Link>
        </h3>
        {product.attribution ? (
          <p className="mt-1 text-small text-ink-muted">{product.attribution}</p>
        ) : null}

        <p className="mt-2 font-ui text-small">
          {product.status === 'coming_soon' ? (
            <span className="text-ink-muted">Out {formatReleaseMonth(product.releaseDate)}</span>
          ) : (
            <>
              <span>{formatMoney(product.priceCents, product.currency)}</span>
              {product.compareAtCents ? (
                <span className="ml-2 text-ink-muted line-through">
                  {formatMoney(product.compareAtCents, product.currency)}
                </span>
              ) : null}
            </>
          )}
        </p>

        {/*
          The visible "view" affordance. Deliberately not a link: the title
          already stretches a link over the whole card, so a second link to the
          same page would just be a duplicate stop for keyboard and screen
          reader users. aria-hidden leaves it as the visual cue it is, and a
          click anywhere on the card — this cue included — still follows the
          title link.
        */}
        <p
          aria-hidden
          className="mt-3 font-ui text-small font-medium text-ink-muted transition-colors duration-base group-hover:text-ink"
        >
          {VIEW_LABELS[product.type] ?? 'View item'} →
        </p>

        {/*
          Quick add. Only for a title that can actually be bought — a
          coming-soon book needs the waitlist form on its own page, and a
          sold-out issue has nothing to add. Showing a disabled button for
          those would be noise on every card.

          mt-auto pins it to the bottom so the row of buttons lines up across
          cards with different title lengths.
        */}
        {product.purchasable ? (
          <div className="relative z-10 mt-auto pt-3">
            <QuickAdd productId={product.id} title={product.title} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatReleaseMonth(date: string | null): string {
  if (!date) return 'soon';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'soon';
  return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function ProductGrid({
  products,
  emptyMessage = 'Nothing here yet.',
}: {
  products: ProductSummary[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return <p className="py-12 text-center font-editorial text-ink-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, index) => (
        /*
          Capped at the sixth item: past that the stagger stops reading as a
          sequence and starts reading as the page being slow.
        */
        <Reveal as="li" key={product.id} delay={Math.min(index, 5) * 70}>
          <ProductCard product={product} />
        </Reveal>
      ))}
    </ul>
  );
}
