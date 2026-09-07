import Link from 'next/link';
import { Button, Eyebrow, HandDrawnRule } from '@/components/primitives';

/**
 * Root 404, for URLs that match no route group at all.
 *
 * Carries a minimal header rather than the full storefront chrome: it sits
 * outside the (site) group, so importing CartProvider here just to render a
 * cart badge on an error page would not earn its keep.
 */
export default function NotFound() {
  return (
    <>
      <header className="border-b border-rule bg-paper">
        <div className="shell py-4">
          <Link href="/" className="font-display text-h3 tracking-tight">
            ZHS&nbsp;Press
          </Link>
        </div>
      </header>

      <main className="shell py-32">
        <Eyebrow>404</Eyebrow>
        <h1 className="mt-4 text-display">We could not find that page.</h1>
        <HandDrawnRule className="mt-5 max-w-[200px] text-terracotta" />
        <p className="prose-editorial mt-6 text-ink-muted">
          It may have moved when the site was rebuilt. The shop is the best place to start.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button href="/shop">Shop</Button>
          <Button href="/" variant="outline">
            Home
          </Button>
        </div>
      </main>
    </>
  );
}
