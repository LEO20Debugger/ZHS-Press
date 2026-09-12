/**
 * A deliberately small Markdown renderer for editor-written page copy.
 *
 * **Why not MDX**, despite the column being called `body_mdx`: MDX is JSX. It
 * imports and executes components, so rendering MDX typed into an admin panel
 * turns a content field into a code-execution surface. Nothing About or
 * Submissions needs is worth that.
 *
 * **Why not a Markdown library**: every mainstream one passes raw HTML through
 * by design, because that is what Markdown specifies. Making that safe needs a
 * sanitiser, and sanitising properly on the server needs a DOM. That is three
 * dependencies and a policy to maintain, to render prose.
 *
 * So the order here is the whole security argument: **escape everything first,
 * then apply formatting to the escaped text.** Raw HTML in the source cannot
 * survive, because by the time any pattern is matched, `<` is already `&lt;`.
 * The output can only ever contain the handful of tags emitted below.
 *
 * Supported: headings (##, ###), paragraphs, bold, italic, inline code, links,
 * unordered and ordered lists, and blockquotes. Not supported, deliberately:
 * images, tables, raw HTML, and anything else that would invite an editor to
 * reach for a tool that is not here.
 */

/** Escapes text for HTML. Runs before anything else, on every input. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Whether a link target is safe to emit.
 *
 * `javascript:` and `data:` URLs in an href execute script on click, which is
 * the one hole an escaping-only approach leaves open — the escaping protects
 * the *markup*, not the semantics of an attribute value. Anything not
 * recognised is dropped rather than guessed at.
 */
function safeHref(href: string): string | null {
  const trimmed = href.trim();

  // Allow site-relative paths, anchors, and explicit http(s)/mailto.
  if (/^\/(?!\/)/.test(trimmed) || trimmed.startsWith('#')) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;

  return null;
}

/** Inline formatting, applied to already-escaped text. */
function inline(text: string): string {
  return (
    text
      // Code first, so markers inside it are not then treated as emphasis.
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
        const safe = safeHref(href);
        // An unsafe target keeps the label as plain text rather than silently
        // dropping the words the editor wrote.
        if (!safe) return label;

        const external = /^https?:\/\//i.test(safe);
        const attributes = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${safe}"${attributes}>${label}</a>`;
      })
  );
}

export function renderMarkdown(source: string): string {
  if (!source?.trim()) return '';

  // Escaped once, up front. Everything below operates on safe text.
  const escaped = escapeHtml(source.replace(/\r\n/g, '\n'));
  const blocks = escaped.split(/\n{2,}/);
  const html: string[] = [];

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    const lines = block.split('\n');

    // Heading
    const heading = /^(#{2,3})\s+(.*)$/.exec(lines[0] ?? '');
    if (heading && lines.length === 1) {
      const level = heading[1]!.length;
      html.push(`<h${level}>${inline(heading[2]!.trim())}</h${level}>`);
      continue;
    }

    // Unordered list
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      const items = lines.map((line) => `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      const items = lines.map((line) => `<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`);
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Blockquote
    if (lines.every((line) => /^&gt;\s?/.test(line))) {
      const quoted = lines.map((line) => line.replace(/^&gt;\s?/, '')).join(' ');
      html.push(`<blockquote><p>${inline(quoted)}</p></blockquote>`);
      continue;
    }

    // Paragraph. A single newline inside one becomes a line break, which is
    // what someone typing an address or a list of dates expects.
    html.push(`<p>${inline(lines.join('\n')).replace(/\n/g, '<br />')}</p>`);
  }

  return html.join('\n');
}

/**
 * First paragraph as plain text, for a meta description fallback.
 *
 * Tags are stripped rather than escaped — the result is going into a `content`
 * attribute, not into markup.
 */
export function markdownExcerpt(source: string, maxLength = 160): string {
  const firstBlock = source.replace(/\r\n/g, '\n').split(/\n{2,}/).find((block) => {
    const trimmed = block.trim();
    return trimmed && !/^#{1,6}\s/.test(trimmed);
  });

  if (!firstBlock) return '';

  const plain = firstBlock
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}
