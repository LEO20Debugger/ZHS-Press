'use client';

import Link from 'next/link';
import { IconChevron } from './nav-icons';
import { useDisclosure } from './use-disclosure';

export interface FilterOption {
  href: string;
  label: string;
  current: boolean;
}

/**
 * A labelled dropdown for the shop's filter and sort controls on a phone.
 *
 * Laid out flat, those controls cost 170px of an 812px screen — and because
 * the bar is sticky, that is 170px gone for the whole session, on top of the
 * 69px header. Nearly a third of the display, permanently, to choose between
 * four categories in a nine-item catalogue. Collapsed to two triggers it is
 * one row.
 *
 * What is given up is at-a-glance discoverability: the categories no longer
 * announce themselves, they have to be opened. That trade is only worth making
 * because the trigger states what is selected — "Everything", "Books" — so the
 * one thing the flat row said for free is still said, and the products get the
 * space instead.
 *
 * The options stay real links with real URLs, built by the server component
 * that owns the query string. This is a presentation shell: it opens, it
 * closes, it knows nothing about the shop.
 */
export function FilterDropdown({
  label,
  options,
  align = 'left',
}: {
  /** The quiet part — what is being chosen. */
  label: string;
  options: FilterOption[];
  align?: 'left' | 'right';
}) {
  const { ref, closing, close } = useDisclosure();

  /*
   * The trigger states the selection, which is what pays for hiding the
   * options. An empty list has no selection to state and no options to open,
   * so the control is not worth drawing at all.
   */
  const selected = options.find((option) => option.current) ?? options[0];
  if (!selected) return null;

  return (
    <details ref={ref} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-pill border border-rule px-4 py-2 transition-colors duration-fast hover:border-ink [&::-webkit-details-marker]:hidden">
        <span className="eyebrow">{label}</span>
        <span className="text-small">{selected.label}</span>
        {/* Turns over when open, so the control says which way it will go. */}
        <IconChevron
          size={14}
          className="disclosure-chevron text-ink-muted"
        />
      </summary>

      {/*
        One listener on the panel rather than one per option: a filter changes
        only the query string, so the route-change effect inside useDisclosure
        never fires for it, and this is what actually shuts the panel when
        something is picked.
      */}
      <ul
        onClick={close}
        data-closing={closing || undefined}
        className={`menu-panel absolute top-12 z-30 w-56 overflow-hidden rounded-md border border-rule bg-paper-raised p-2 shadow-panel ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {options.map((option, position) => (
          <li
            key={option.href}
            className="menu-item"
            style={{ '--menu-index': position } as React.CSSProperties}
          >
            <Link
              href={option.href}
              aria-current={option.current ? 'true' : undefined}
              className={`block rounded-sm px-3 py-2.5 text-small transition-colors duration-fast ${
                option.current ? 'bg-paper-deep text-ink' : 'text-ink-muted hover:bg-paper'
              }`}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
