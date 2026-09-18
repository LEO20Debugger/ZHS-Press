import {
  IconAbout,
  IconBooks,
  IconMagazine,
  IconShop,
  IconStationery,
  IconSubmissions,
} from './nav-icons';

/**
 * The primary navigation, alphabetical at both levels.
 *
 * What the press sells sits under Shop rather than beside it: Books, Magazine
 * and Stationery are three views of one catalogue, and listing them flat left
 * the top level naming the same thing four times over.
 *
 * Books and Magazine keep their own section pages — those are editorial, not
 * filtered grids, and LIGHT in particular has an archive that the shop does
 * not show. Stationery has no such page, so it points at the shop already
 * filtered to it.
 *
 * Kept in its own module because the header is split across the boundary: the
 * desktop row renders on the server, the mobile menu is a client component,
 * and components cannot be handed across that line as props. Both import this.
 */
export const NAV = [
  { href: '/about', label: 'About', Icon: IconAbout },
  {
    href: '/shop',
    label: 'Shop',
    Icon: IconShop,
    children: [
      { href: '/books', label: 'Books', Icon: IconBooks },
      { href: '/magazine', label: 'Magazine', Icon: IconMagazine },
      { href: '/shop?category=stationery', label: 'Stationery', Icon: IconStationery },
    ],
  },
  { href: '/submissions', label: 'Submissions', Icon: IconSubmissions },
] as const;

/**
 * Every destination, flattened and alphabetised, for the footer.
 *
 * A footer is a directory, not a journey — nesting there would hide Stationery
 * behind a heading nobody can expand on a page they have already scrolled to
 * the bottom of.
 */
export const FOOTER_NAV = NAV.flatMap((item) => [
  { href: item.href, label: item.label },
  ...('children' in item ? item.children.map((c) => ({ href: c.href, label: c.label })) : []),
]).sort((a, b) => a.label.localeCompare(b.label));
