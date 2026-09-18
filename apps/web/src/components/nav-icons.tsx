/**
 * Icons for the storefront's mobile menu.
 *
 * Separate from the admin set rather than imported from it: that file is
 * documented as the admin's own vocabulary, and a storefront reaching into it
 * would make every future admin glyph a change to the shop. They share a house
 * style — 1.5 stroke, no fills, square-ish joins — because they are drawn to
 * the same rules, not because they share code.
 *
 * Every one of these sits beside its own text label, so all are decorative and
 * carry aria-hidden. One that ever stands alone needs a label on whatever
 * wraps it.
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

/**
 * Close. The one glyph here that is not decorative: it sits in a button with
 * no text, so that button carries the label.
 */
export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

/** Chevron: points down at a closed panel, and turns over with it. */
export function IconChevron(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

/** Home: a house, because on a phone the logo is a small mark to aim at. */
export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.5Z" />
      <path d="M9.5 20v-6h5v6" />
    </Svg>
  );
}

/** Shop: a tote, the thing you leave a small press carrying. */
export function IconShop(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 8h13l1 11.5h-15L5.5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </Svg>
  );
}

/** Books: an open book, the thing this press actually makes. */
export function IconBooks(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v13c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-13c-4.5 0-6.5.5-8 2Z" />
      <path d="M12 6.5v13" />
    </Svg>
  );
}

/** Magazine: a folded issue, with a headline across the top. */
export function IconMagazine(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5h11a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V5Z" />
      <path d="M17 9h3v8a2 2 0 0 1-2 2" />
      <path d="M7 8.5h7M7 12h7M7 15.5h4" />
    </Svg>
  );
}

/** Stationery: a pencil, mid-thought. */
export function IconStationery(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20l1.2-4.2L16 5a2.1 2.1 0 0 1 3 3L8.2 18.8 4 20Z" />
      <path d="m14.5 6.5 3 3" />
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

/** About: the press itself — a mark on a page. */
export function IconAbout(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Svg>
  );
}
