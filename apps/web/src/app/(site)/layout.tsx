import { CartProvider } from '@/components/cart-provider';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';

/**
 * The public storefront shell.
 *
 * Scoped to this route group so the admin area does not inherit the shop
 * header, footer or cart — admin has no use for any of them, and CartProvider
 * would otherwise fire a needless /api/cart request on every admin page.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </CartProvider>
  );
}
