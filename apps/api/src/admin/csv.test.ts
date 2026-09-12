import { describe, expect, it } from 'vitest';
import { escapeCsvValue, toCsv } from './csv';

describe('escapeCsvValue — quoting', () => {
  it('leaves a plain value alone', () => {
    expect(escapeCsvValue('ada@example.com')).toBe('ada@example.com');
  });

  it('quotes a value containing a comma', () => {
    // Book titles contain commas constantly — "Light, Issue Four".
    expect(escapeCsvValue('Light, Issue Four')).toBe('"Light, Issue Four"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsvValue('The "Long" Rain')).toBe('"The ""Long"" Rain"');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCsvValue('line one\nline two')).toBe('"line one\nline two"');
  });

  it('renders null and undefined as empty', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });

  it('stringifies numbers and dates without quoting them', () => {
    expect(escapeCsvValue(42)).toBe('42');
    expect(escapeCsvValue('2026-09-12T10:00:00.000Z')).toBe('2026-09-12T10:00:00.000Z');
  });
});

describe('escapeCsvValue — formula injection', () => {
  /*
   * A cell beginning =, +, -, @ or a control character is executed as a formula
   * when the file is opened in Excel or Sheets. Every value in these exports
   * came from outside the press, and the file is opened by someone who works
   * there.
   */
  it('neutralises a leading equals', () => {
    const result = escapeCsvValue('=HYPERLINK("http://evil.test","Click")');
    expect(result.startsWith('"\'=') || result.startsWith("'=")).toBe(true);
    expect(result).not.toMatch(/^=/);
  });

  it('neutralises every dangerous leading character', () => {
    for (const prefix of ['=', '+', '-', '@', '\t', '\r']) {
      const result = escapeCsvValue(`${prefix}cmd`);
      expect(result.replace(/^"/, '').startsWith("'"), JSON.stringify(prefix)).toBe(true);
    }
  });

  it('puts the guard inside the quotes, not before them', () => {
    // A guard outside the quoting would itself be part of the CSV structure
    // rather than part of the cell.
    expect(escapeCsvValue('=A1,B2')).toBe('"\'=A1,B2"');
  });

  it('leaves a value that merely contains those characters alone', () => {
    // Only a *leading* character is dangerous. Mangling every hyphen would
    // corrupt dates and every hyphenated name in the list.
    expect(escapeCsvValue('2026-09-12')).toBe('2026-09-12');
    expect(escapeCsvValue('ada@example.com')).toBe('ada@example.com');
    expect(escapeCsvValue('Carter-Smith')).toBe('Carter-Smith');
  });
});

describe('toCsv', () => {
  it('builds a document with CRLF line endings', () => {
    const csv = toCsv(['email', 'source'], [['a@b.com', 'footer']]);
    expect(csv).toBe('email,source\r\na@b.com,footer');
  });

  it('escapes the header too', () => {
    expect(toCsv(['a,b'], [])).toBe('"a,b"');
  });

  it('handles an empty result set', () => {
    // A header-only file is correct: it tells the reader the export ran and
    // found nothing, rather than looking like a failed download.
    expect(toCsv(['email'], [])).toBe('email');
  });

  it('keeps columns aligned when a value is missing', () => {
    const csv = toCsv(['email', 'source', 'confirmed'], [['a@b.com', null, '']]);
    expect(csv.split('\r\n')[1]).toBe('a@b.com,,');
  });

  it('survives a row built from hostile values end to end', () => {
    const csv = toCsv(
      ['email', 'title'],
      [['=cmd|calc', 'Light, "Issue" Four\nsecond line']],
    );
    const dataLine = csv.slice(csv.indexOf('\r\n') + 2);
    expect(dataLine).not.toMatch(/^=/);
    expect(dataLine).toContain('""Issue""');
  });
});
