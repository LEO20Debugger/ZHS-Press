/**
 * Catalogue search, shared by the header's instant search and the /search page
 * so the two can never disagree about what matches.
 *
 * Deliberately simple, because the catalogue is small — tens of titles, not
 * thousands. The whole list is searched in memory: no index to build, no
 * server round trip per keystroke. If the catalogue grows into the hundreds,
 * this is the function to move behind the API; its callers need not change.
 */

export interface Searchable {
  title: string;
  subtitle: string | null;
  attribution: string | null;
  blurb: string | null;
  type: string;
}

/** Words a reader might type for each kind of product. */
const TYPE_WORDS: Record<string, string> = {
  book: 'book books',
  magazine: 'magazine magazines issue issues light',
  stationery: 'stationery journal journals notebook notebooks',
};

/**
 * Lower case, accents folded, punctuation to spaces.
 *
 * Folding is what lets "aduke" find "Àdùkẹ́" — a reader on a phone keyboard
 * should not need to type the tone marks to find a Yoruba title.
 */
export function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Every word of the query must appear somewhere in the product; results are
 * ranked by where the query landed.
 *
 *   title starts with it  >  a title word starts with it  >  title contains it
 *   >  author  >  subtitle  >  description or kind
 *
 * Each word is matched as a prefix of a word in the text, so "ezep" finds
 * Ezepue but "pue" does not drag her books into every search.
 */
export function searchCatalog<T extends Searchable>(items: T[], query: string, limit?: number): T[] {
  const q = normalise(query);
  if (!q) return [];
  const terms = q.split(' ');

  const scored: Array<{ item: T; score: number; index: number }> = [];

  items.forEach((item, index) => {
    const title = normalise(item.title);
    const author = normalise(item.attribution ?? '');
    const subtitle = normalise(item.subtitle ?? '');
    const rest = normalise(`${item.blurb ?? ''} ${TYPE_WORDS[item.type] ?? item.type}`);
    const words = ` ${title} ${author} ${subtitle} ${rest} `;

    // Every term has to start a word somewhere, or the item is out.
    if (!terms.every((term) => words.includes(` ${term}`))) return;

    let score = 0;
    if (title.startsWith(q)) score += 100;
    else if (` ${title}`.includes(` ${q}`)) score += 70;
    else if (title.includes(q)) score += 50;
    if (` ${author}`.includes(` ${q}`)) score += 40;
    if (` ${subtitle}`.includes(` ${q}`)) score += 20;
    for (const term of terms) {
      if (` ${title}`.includes(` ${term}`)) score += 10;
      else if (` ${author}`.includes(` ${term}`)) score += 6;
      else if (` ${subtitle}`.includes(` ${term}`)) score += 3;
      else score += 1;
    }

    scored.push({ item, score, index });
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const ranked = scored.map(({ item }) => item);
  return limit == null ? ranked : ranked.slice(0, limit);
}
