/**
 * The admin icon set.
 *
 * Hand-written SVG rather than an icon package. Five glyphs do not justify a
 * dependency, and a general-purpose set would bring a house style of its own —
 * uniform 2px strokes and rounded corners that read as a SaaS dashboard, which
 * is the one thing this admin is not meant to look like. These are drawn to
 * match the storefront: a lighter stroke, square-ish joins, no fills.
 *
 * Every icon is decorative here — each one sits beside its own text label — so
 * they carry aria-hidden and no title. An icon that ever stands alone needs a
 * label on the control that wraps it, not a title element.
 */

interface IconProps {
  /** Matches the cap height of the label beside it at text-small. */
  size?: number;
  className?: string;
}

function Svg({
  size = 18,
  className = '',
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

/** Overview: the dashboard's tiles, abstracted. */
export function IconOverview(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </Svg>
  );
}

/** Catalogue: an open book, the thing this press actually makes. */
export function IconCatalogue(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v13c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-13c-4.5 0-6.5.5-8 2Z" />
      <path d="M12 6.5v13" />
    </Svg>
  );
}

/** Submissions: an envelope, arriving. */
export function IconSubmissions(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" />
      <path d="m3 6 9 7 9-7" />
    </Svg>
  );
}

/** Amazon parity: two links of a chain — matched, or not. */
export function IconParity(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
    </Svg>
  );
}

/** Orders: a parcel on its way out. */
export function IconOrders(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
      <path d="m3 7.5 9 4.5 9-4.5" />
      <path d="M12 12v9" />
    </Svg>
  );
}

/** The menu button, closed. */
export function IconMenu(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Svg>
  );
}

/** The menu button, open. */
export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </Svg>
  );
}

/** View site: leaving the admin for the storefront. */
export function IconExternal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Svg>
  );
}

/** Sign out. */
export function IconSignOut(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4" />
      <path d="M16 16l4-4-4-4" />
      <path d="M20 12H9" />
    </Svg>
  );
}

/**
 * View: an eye, for opening a record without leaving the list.
 *
 * Unlike the navigation glyphs above, this one stands alone in a table cell
 * with no visible label — so the *button* wrapping it must carry the name, and
 * that name should say which row it opens. "View" repeated down a column tells
 * a screen-reader user nothing about which order they are about to open.
 */
export function IconView(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

/** Audience: people, for the waitlist and subscriber lists. */
export function IconAudience(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6" />
    </Svg>
  );
}
