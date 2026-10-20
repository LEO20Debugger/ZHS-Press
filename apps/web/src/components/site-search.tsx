'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { formatMoney, searchCatalog, type Currency } from '@zhs/shared';
import { productHref } from '@/lib/product-href';
import { IconBooks, IconClose, IconMagazine, IconSearch, IconStationery } from './nav-icons';

interface SearchItem {
  id: number;
  slug: string;
  type: 'book' | 'magazine' | 'stationery';
  status: string;
  title: string;
  subtitle: string | null;
  attribution: string | null;
  blurb: string | null;
  priceCents: number;
  currency: Currency;
  coverImage: { url: string; alt: string } | null;
}

/** Results shown in the panel; "See all" leads to the full list. */
const PANEL_LIMIT = 8;

const BROWSE = [
  { href: '/books', label: 'Books', Icon: IconBooks },
  { href: '/magazine', label: 'LIGHT magazine', Icon: IconMagazine },
  { href: '/shop?category=stationery', label: 'Stationery', Icon: IconStationery },
] as const;

/*
 * The catalogue, fetched once per visit — the first time search is opened —
 * and kept for every later open. Module scope, so closing and reopening the
 * panel, or navigating between pages, does not fetch it again.
 */
let indexPromise: Promise<SearchItem[]> | null = null;

function loadIndex(): Promise<SearchItem[]> {
  indexPromise ??= fetch('/api/search')
    .then((response) => {
      if (!response.ok) throw new Error('unavailable');
      return response.json() as Promise<SearchItem[]>;
    })
    .catch((error) => {
      // Let the next open try again rather than caching the failure.
      indexPromise = null;
      throw error;
    });
  return indexPromise;
}

function priceLabel(item: SearchItem): string {
  if (item.status === 'coming_soon') return 'Coming soon';
  if (item.status === 'sold_out') return 'Sold out';
  return formatMoney(item.priceCents, item.currency);
}

/** True when a key press is going into a field, where "/" is just a slash. */
function typingInField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * The site-wide search: a button in the header, and the panel it opens.
 *
 * Results appear as you type, searched in the browser over the whole
 * catalogue (see searchCatalog). Enter opens the highlighted result, or the
 * full results page when nothing is highlighted, so a search can always be
 * shared as a link.
 *
 * A native <dialog> opened with showModal(): it traps focus, closes on Escape
 * and sits above everything else on the page without z-index juggling.
 * Shortcuts — "/" and Ctrl/⌘ K — follow what readers already know from other
 * sites.
 */
export function SiteSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);

  const results = useMemo(() => (items ? searchCatalog(items, query) : []), [items, query]);
  const shown = results.slice(0, PANEL_LIMIT);
  const trimmed = query.trim();

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // The page behind should not scroll while the panel is up.
    document.documentElement.style.overflow = 'hidden';
    inputRef.current?.select();

    setFailed(false);
    loadIndex()
      .then(setItems)
      .catch(() => setFailed(true));
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // A navigation from inside the panel lands on a new page with it shut.
  useEffect(() => {
    close();
  }, [pathname, close]);

  // "/" and Ctrl/⌘ K open search from anywhere on the site.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const shortcut =
        (event.key === 'k' && (event.metaKey || event.ctrlKey)) ||
        (event.key === '/' && !typingInField(event.target) && !event.metaKey && !event.ctrlKey);
      if (!shortcut) return;
      event.preventDefault();
      open();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // A new query starts with nothing highlighted, so Enter means "search".
  useEffect(() => {
    setActive(-1);
  }, [query]);

  function goToResults() {
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    close();
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (shown.length === 0 ? -1 : (current + 1) % shown.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (shown.length === 0 ? -1 : current <= 0 ? shown.length - 1 : current - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const picked = shown[active];
      if (picked) {
        router.push(productHref(picked));
        close();
      } else {
        goToResults();
      }
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Search"
        title="Search (/)"
        className="flex min-h-[40px] min-w-[40px] items-center justify-center text-ink transition-colors duration-fast hover:text-ink-muted"
      >
        <IconSearch size={20} />
      </button>

      {/*
        Closing — by Escape, the close button, a backdrop click or a result —
        always goes through the dialog's own close event, so the page is
        unlocked in exactly one place.
      */}
      <dialog
        ref={dialogRef}
        aria-label="Search the shop"
        onClose={() => {
          document.documentElement.style.overflow = '';
          setQuery('');
        }}
        onClick={(event) => {
          // A click on the dialog element itself is a click on its backdrop.
          if (event.target === dialogRef.current) close();
        }}
        className="search-dialog m-0 h-dvh max-h-none w-full max-w-none bg-paper p-0 text-ink backdrop:bg-[color-mix(in_srgb,var(--ink)_35%,transparent)] backdrop:backdrop-blur-sm sm:mx-auto sm:mt-[12vh] sm:h-auto sm:max-h-[72vh] sm:w-[min(40rem,calc(100vw-2rem))] sm:rounded-md sm:border sm:border-rule sm:shadow-panel"
      >
        <div className="flex h-full flex-col sm:max-h-[72vh]">
          <div className="flex items-center gap-3 border-b border-rule px-4 sm:px-5">
            <IconSearch size={20} className="text-ink-muted" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search books, LIGHT and stationery"
              aria-label="Search"
              role="combobox"
              aria-expanded={shown.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? optionId(active) : undefined}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="min-h-[56px] w-full flex-1 bg-transparent font-ui text-body text-ink placeholder:text-ink-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              type="button"
              onClick={close}
              aria-label="Close search"
              className="flex min-h-[40px] min-w-[40px] items-center justify-center text-ink-muted hover:text-ink"
            >
              <IconClose size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-3">
            {failed ? (
              <p className="px-3 py-6 text-small text-ink-muted">
                Search is unavailable right now. Try again in a moment, or browse below.
              </p>
            ) : items === null ? (
              <p className="px-3 py-6 text-small text-ink-muted" aria-live="polite">
                Loading…
              </p>
            ) : trimmed && shown.length === 0 ? (
              <p className="px-3 py-6 text-small text-ink-muted" aria-live="polite">
                Nothing found for &ldquo;{trimmed}&rdquo;. Try an author&rsquo;s name, or browse:
              </p>
            ) : null}

            {shown.length > 0 ? (
              <ul id={listId} role="listbox" aria-label="Results">
                {shown.map((item, index) => (
                  <li key={item.id} id={optionId(index)} role="option" aria-selected={index === active}>
                    <Link
                      href={productHref(item)}
                      onClick={close}
                      /*
                        Movement, not entry. Results render under wherever the
                        cursor happens to be resting, and mouseenter fires for
                        that — which silently highlighted a result and turned
                        Enter from "see all results" into "open this one".
                        mousemove only fires when the hand actually moves.
                      */
                      onMouseMove={() => {
                        if (active !== index) setActive(index);
                      }}
                      tabIndex={-1}
                      className={`flex items-center gap-4 rounded-sm px-3 py-2.5 transition-colors duration-fast ${
                        index === active ? 'bg-paper-deep' : 'hover:bg-paper-deep'
                      }`}
                    >
                      <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-sm bg-paper-deep">
                        {item.coverImage ? (
                          <Image
                            src={item.coverImage.url}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-body">{item.title}</span>
                        {item.attribution ? (
                          <span className="block truncate text-caption text-ink-muted">
                            {item.attribution}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-caption text-ink-muted">{priceLabel(item)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {/*
              With nothing typed, or nothing found, the panel offers somewhere
              to go rather than standing empty.
            */}
            {!trimmed || (items !== null && shown.length === 0) || failed ? (
              <div className="px-3 pt-2">
                {!trimmed && !failed ? <p className="eyebrow">Browse</p> : null}
                <ul className="mt-2 grid gap-1 sm:grid-cols-3">
                  {BROWSE.map(({ href, label, Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={close}
                        className="flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-small text-ink-muted transition-colors duration-fast hover:bg-paper-deep hover:text-ink"
                      >
                        <Icon size={16} />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {trimmed && results.length > 0 ? (
            <div className="flex items-center justify-between gap-4 border-t border-rule px-5 py-3 font-ui text-caption text-ink-muted">
              <button type="button" onClick={goToResults} className="link-underline text-ink">
                See all {results.length} {results.length === 1 ? 'result' : 'results'}
              </button>
              <span className="hidden sm:inline">
                <kbd className="font-ui">↑</kbd> <kbd className="font-ui">↓</kbd> to move ·{' '}
                <kbd className="font-ui">Enter</kbd> to open · <kbd className="font-ui">Esc</kbd> to close
              </span>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
