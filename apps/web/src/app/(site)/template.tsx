/**
 * A template re-mounts on every navigation, unlike a layout. That is exactly
 * what the page-enter animation needs: it should replay when the route
 * changes, not run once for the life of the session.
 *
 * Scoped to the storefront. The admin area is a tool, and a tool that animates
 * every time you click between screens gets tiring by the tenth click.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
