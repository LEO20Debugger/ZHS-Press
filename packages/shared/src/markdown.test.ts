import { describe, expect, it } from 'vitest';
import { markdownExcerpt, renderMarkdown } from './markdown';

describe('renderMarkdown — structure', () => {
  it('wraps prose in paragraphs', () => {
    expect(renderMarkdown('Hello there.')).toBe('<p>Hello there.</p>');
  });

  it('splits paragraphs on a blank line', () => {
    expect(renderMarkdown('One.\n\nTwo.')).toBe('<p>One.</p>\n<p>Two.</p>');
  });

  it('turns a single newline inside a paragraph into a break', () => {
    // What someone typing an address or a run of dates expects.
    expect(renderMarkdown('14 Marina Road\nLagos')).toBe('<p>14 Marina Road<br />Lagos</p>');
  });

  it('renders headings but not h1', () => {
    // The page title is already an h1; a second one breaks the outline.
    expect(renderMarkdown('## Submissions')).toBe('<h2>Submissions</h2>');
    expect(renderMarkdown('### Rates')).toBe('<h3>Rates</h3>');
    expect(renderMarkdown('# Nope')).toBe('<p># Nope</p>');
  });

  it('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- One\n- Two')).toBe('<ul><li>One</li><li>Two</li></ul>');
    expect(renderMarkdown('1. First\n2. Second')).toBe('<ol><li>First</li><li>Second</li></ol>');
  });

  it('renders a blockquote', () => {
    expect(renderMarkdown('> We read everything.')).toBe(
      '<blockquote><p>We read everything.</p></blockquote>',
    );
  });

  it('renders emphasis and inline code', () => {
    expect(renderMarkdown('**bold** and *italic* and `code`')).toBe(
      '<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>',
    );
  });

  it('does not treat markers inside code as emphasis', () => {
    expect(renderMarkdown('`a * b`')).toBe('<p><code>a * b</code></p>');
  });

  it('returns nothing for empty input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('   \n\n  ')).toBe('');
  });
});

describe('renderMarkdown — links', () => {
  it('renders a site-relative link', () => {
    expect(renderMarkdown('[Shop](/shop)')).toBe('<p><a href="/shop">Shop</a></p>');
  });

  it('opens external links in a new tab, safely', () => {
    const html = renderMarkdown('[Amazon](https://amazon.com/x)');
    expect(html).toContain('target="_blank"');
    // Without noopener the opened page can reach back through window.opener.
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('allows mailto', () => {
    expect(renderMarkdown('[Email](mailto:hello@zhspress.org)')).toContain(
      'href="mailto:hello@zhspress.org"',
    );
  });

  it('keeps the label but drops a javascript: target', () => {
    /*
     * The single hole an escape-only approach leaves: escaping protects the
     * markup, not the meaning of an attribute value. A javascript: href runs
     * on click even though every angle bracket was escaped.
     */
    const html = renderMarkdown('[Click me](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a');
    expect(html).toContain('Click me');
  });

  it('drops a data: target', () => {
    const html = renderMarkdown('[x](data:text/html;base64,PHNjcmlwdD4=)');
    expect(html).not.toContain('<a');
    expect(html).not.toContain('data:');
  });

  it('drops a protocol-relative target', () => {
    // "//evil.test" inherits the current scheme and leaves the site.
    expect(renderMarkdown('[x](//evil.test)')).not.toContain('<a');
  });

  it('is not fooled by casing or leading whitespace in the scheme', () => {
    for (const href of ['JavaScript:alert(1)', '  javascript:alert(1)', 'JAVASCRIPT:alert(1)']) {
      expect(renderMarkdown(`[x](${href})`), href).not.toContain('<a');
    }
  });
});

describe('renderMarkdown — injection', () => {
  it('escapes raw HTML rather than passing it through', () => {
    // The central claim of this renderer. Every mainstream Markdown library
    // would emit this tag verbatim, because the spec says to.
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes an img with an onerror handler', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('cannot be escaped out of via a crafted link label', () => {
    const html = renderMarkdown('[<img src=x onerror=alert(1)>](/shop)');
    expect(html).not.toContain('<img');
  });

  it('cannot inject an attribute through a link target', () => {
    const html = renderMarkdown('[x](/shop" onmouseover="alert(1))');
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).not.toContain('" onmouseover');
  });

  it('escapes ampersands without double-escaping the entities it makes', () => {
    expect(renderMarkdown('Tom & Jerry')).toBe('<p>Tom &amp; Jerry</p>');
    expect(renderMarkdown('Tom & Jerry')).not.toContain('&amp;amp;');
  });

  it('emits only the small set of tags it is allowed to', () => {
    const source = [
      '## Heading',
      '',
      'Text with **bold**, *italic*, `code`, and a [link](/x).',
      '',
      '- item',
      '',
      '> quote',
    ].join('\n');

    const tags = [...renderMarkdown(source).matchAll(/<(\/?[a-z0-9]+)/gi)].map((m) =>
      m[1]!.replace('/', '').toLowerCase(),
    );

    const allowed = new Set(['h2', 'h3', 'p', 'strong', 'em', 'code', 'a', 'ul', 'ol', 'li', 'blockquote', 'br']);
    for (const tag of tags) expect(allowed.has(tag), `unexpected tag <${tag}>`).toBe(true);
  });
});

describe('markdownExcerpt', () => {
  it('takes the first paragraph, skipping a heading', () => {
    expect(markdownExcerpt('## About\n\nZHS Press is an independent publisher.')).toBe(
      'ZHS Press is an independent publisher.',
    );
  });

  it('strips markdown syntax', () => {
    expect(markdownExcerpt('A **bold** [link](/x) here')).toBe('A bold link here');
  });

  it('truncates with an ellipsis', () => {
    const result = markdownExcerpt('word '.repeat(80), 40);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns empty for nothing usable', () => {
    expect(markdownExcerpt('')).toBe('');
    expect(markdownExcerpt('## Only a heading')).toBe('');
  });
});
