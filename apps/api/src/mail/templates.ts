import { formatMoney, type Currency } from '@zhs/shared';

/**
 * Email templates.
 *
 * Pure functions returning a subject plus both bodies, with no transport and no
 * Nest dependency, so every one of them is unit-testable without sending
 * anything. MailService does the sending; this file decides what is said.
 *
 * Three constraints shape the markup, and they are not stylistic preferences:
 *
 * 1. **Tables, not flexbox.** Outlook renders through Word's HTML engine. It
 *    has no flexbox, no grid, and ignores most positioning.
 * 2. **Inline styles, not classes.** Gmail strips `<style>` blocks in several
 *    contexts, most reliably when a message is forwarded.
 * 3. **No CSS custom properties.** The token system cannot reach here, so the
 *    palette is repeated as literal hex. The one rule that survives intact is
 *    the important one: no #ffffff and no #000000 — grounds stay oat and ink
 *    stays the slightly green near-black, which is what keeps an email looking
 *    like it came from this press rather than from a form builder.
 *
 * Every template also ships a real plain-text body. It is not a courtesy: a
 * text/plain alternative measurably improves deliverability, and some
 * corporate gateways strip HTML outright.
 */

const PAPER = '#faf7f0';
const PAPER_RAISED = '#fffefa';
const PAPER_DEEP = '#f4eee0';
const INK = '#1e2525';
const INK_MUTED = '#565c5c';
const RULE = '#e2dccc';
const TERRACOTTA = '#b13f2f';

const DISPLAY_STACK = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
const UI_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export interface Mail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Where the email logo is served from, or null for the text wordmark.
 *
 * Module-level rather than a parameter on all seven templates, because it is a
 * deployment constant rather than per-message data — it is set once at boot
 * from WEB_BASE_URL and never varies between messages. `configureBrand(null)`
 * restores the text wordmark, which is what the tests run against so they stay
 * independent of whether a base URL happens to be configured.
 */
let brandBaseUrl: string | null = null;

export function configureBrand(baseUrl: string | null): void {
  brandBaseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : null;
}

/**
 * Escapes a value for HTML interpolation.
 *
 * Mandatory on every interpolated value in this file, without exception.
 * Product titles, customer names and submission synopses are all
 * user-supplied, and an email body is HTML rendered in someone else's client.
 * A title containing `<` would corrupt the layout at best; the internal
 * submission alert is the sharper case, since its content comes from an
 * anonymous form on the public internet and is read by staff.
 *
 * Quotes are escaped too, so a value remains safe inside an attribute.
 */
function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Joins a base URL and a path without producing `//` or losing a segment.
 *
 * WEB_BASE_URL is typed into a deployment dashboard by hand and arrives with a
 * trailing slash about half the time. A doubled slash in a confirmation link
 * is the kind of thing that works on one host and 404s on another.
 */
export function url(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * The shared shell.
 *
 * `preheader` is the grey snippet a client shows beside the subject in the
 * inbox list. Left unset, clients scrape the first text they find — which is
 * usually the wordmark, so every message previews identically as "ZHS Press".
 * It is hidden in the body itself by zero dimensions plus `display: none`,
 * belt and braces, because different clients defeat different halves of that.
 */
/**
 * The masthead: the logo when one is configured, the wordmark otherwise.
 *
 * Three constraints decide the shape of this, and all three are email-specific:
 *
 * 1. **PNG, never SVG.** No major mail client renders SVG — Gmail, Outlook and
 *    Apple Mail all drop it — so the crisp vector used on the site is useless
 *    here and a 2x raster is the sharpest thing available.
 * 2. **Images are blocked by default** in Outlook desktop and plenty of
 *    corporate gateways. The `alt` text is therefore not a fallback nicety, it
 *    is what a good share of recipients actually see — so it carries the type
 *    styling of the wordmark it replaces. Blocked, it still reads as ZHS PRESS
 *    in letterspaced caps rather than as a broken-image label.
 * 3. **Dimensions are set as attributes**, not only in CSS, because a client
 *    that blocks the image still reserves the box from them.
 */
function wordmark(): string {
  const wordmarkStyle =
    `font-family:${DISPLAY_STACK};font-size:16px;letter-spacing:0.12em;` +
    `text-transform:uppercase;color:${INK};`;

  if (!brandBaseUrl) {
    return `<span class="wordmark" style="${wordmarkStyle}">ZHS&nbsp;Press</span>`;
  }

  return `<img src="${esc(`${brandBaseUrl}/brand/logo-email.png`)}" width="132" height="93" alt="ZHS Press" style="display:block;border:0;outline:none;text-decoration:none;width:132px;height:auto;${wordmarkStyle}">`;
}

function shell(bodyHtml: string, { preheader }: { preheader: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<style>
  /*
   * Mobile-first, and that direction is deliberate.
   *
   * Some clients strip <style> from the head, so whatever is in the inline
   * attributes is what those recipients get. Putting the NARROW layout inline
   * and widening it here means a stripped <style> degrades to the cramped-safe
   * version, which is legible at every width. The reverse — desktop inline,
   * narrowed by a media query — degrades to horizontal scrolling on a phone.
   *
   * 480px is the breakpoint because the frame is 560px wide: below that the
   * generous padding costs more than it buys. A Galaxy Fold's cover screen is
   * 280px, which is the width this is actually tuned against.
   */
  @media screen and (min-width: 480px) {
    .frame { padding: 32px 16px !important; }
    .card { padding: 32px !important; }
    .h1 { font-size: 26px !important; }
    .wordmark { font-size: 19px !important; }
    .body-text { font-size: 15px !important; }
  }
  /* Stops iOS inflating text in a way that breaks the two-column money rows. */
  body { -webkit-text-size-adjust: 100%; }
</style>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(
    preheader,
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr><td align="center" class="frame" style="padding:16px 10px;">
<!--
  width="100%" with max-width in CSS, never width="560".
  A fixed width attribute is honoured by Outlook over the stylesheet, which
  forces a 560px frame into a 280px screen and produces horizontal scroll.
-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">

<tr><td style="padding-bottom:16px;">
${wordmark()}
</td></tr>

<tr><td class="card" style="background:${PAPER_RAISED};border:1px solid ${RULE};padding:20px 16px;">
${bodyHtml}
</td></tr>

<tr><td style="padding-top:16px;font-family:${UI_STACK};font-size:12px;line-height:1.6;color:${INK_MUTED};">
ZHS Press — books, <em>Light</em> magazine, and stationery.
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function heading(text: string): string {
  // word-break guards against a single long title with no space in it, which
  // would otherwise push the frame wider than the screen.
  return `<h1 class="h1" style="margin:0 0 14px;font-family:${DISPLAY_STACK};font-size:21px;line-height:1.25;font-weight:normal;color:${INK};word-break:break-word;">${esc(
    text,
  )}</h1>`;
}

function paragraph(html: string): string {
  return `<p class="body-text" style="margin:0 0 16px;font-family:${UI_STACK};font-size:14px;line-height:1.65;color:${INK};">${html}</p>`;
}

function muted(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${UI_STACK};font-size:13px;line-height:1.6;color:${INK_MUTED};">${html}</p>`;
}

/**
 * A button.
 *
 * Padding on the anchor rather than the cell, because Outlook collapses cell
 * padding around an inline element and leaves an unclickable label. The text is
 * paper-on-terracotta at 5.75:1, which is the pairing `validateAccent` returns
 * for this accent — the same rule the storefront follows.
 */
function button(href: string, label: string): string {
  // align="center" plus a centred label so the button reads correctly whether
  // it ends up shrink-wrapped or stretched by a narrow frame. The 44px minimum
  // height is the standard touch target — below it, a thumb misses.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
<tr><td align="center" style="background:${TERRACOTTA};">
<a href="${esc(href)}" style="display:inline-block;min-height:20px;padding:12px 22px;font-family:${UI_STACK};font-size:14px;font-weight:600;letter-spacing:0.02em;line-height:20px;color:${PAPER_RAISED};text-decoration:none;">${esc(
    label,
  )}</a>
</td></tr></table>`;
}

/*
 * There is deliberately no visible copy of the action link in the HTML.
 *
 * An earlier version printed one under every button, reasoning that a client
 * which strips anchors would leave the recipient stranded. In practice the
 * confirmation token is 64 characters, so the result was two wrapped lines of
 * hex under a perfectly good button — the ugliest thing in the message, shown
 * to everyone, to serve a case that is now rare.
 *
 * The plain-text alternative still carries every URL in full, which covers the
 * client that renders no HTML at all. That is where a bare URL belongs.
 */

// ---------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------

export function newsletterConfirmation({ confirmUrl }: { confirmUrl: string }): Mail {
  return {
    subject: 'Confirm your ZHS Press subscription',
    html: shell(
      heading('One click and you are on the list') +
        paragraph(
          'We send a note when a book or an issue of <em>Light</em> is on its way — ' +
            'not often, and never anything else.',
        ) +
        button(confirmUrl, 'Confirm subscription') +
        muted('If you did not ask for this, ignore it and nothing happens.'),
      { preheader: 'Confirm your subscription to hear about new books and issues.' },
    ),
    text: [
      'One click and you are on the list.',
      '',
      'We send a note when a book or an issue of Light is on its way — not often,',
      'and never anything else.',
      '',
      'Confirm your subscription:',
      confirmUrl,
      '',
      'If you did not ask for this, ignore it and nothing happens.',
      '',
      '— ZHS Press',
    ].join('\n'),
  };
}

export function newsletterWelcome({ unsubscribeUrl }: { unsubscribeUrl: string }): Mail {
  return {
    subject: 'You are on the list',
    html: shell(
      heading('You are on the list') +
        paragraph(
          'Thank you. You will hear from us when there is something worth hearing about — ' +
            'a new book, an issue of <em>Light</em>, something for the desk.',
        ) +
        muted(`Changed your mind? <a href="${esc(unsubscribeUrl)}" style="color:${INK_MUTED};">Unsubscribe</a>.`),
      { preheader: 'Your subscription is confirmed.' },
    ),
    text: [
      'You are on the list.',
      '',
      'Thank you. You will hear from us when there is something worth hearing about —',
      'a new book, an issue of Light, something for the desk.',
      '',
      `Unsubscribe: ${unsubscribeUrl}`,
      '',
      '— ZHS Press',
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Order receipt
// ---------------------------------------------------------------------------

export interface ReceiptLine {
  titleSnapshot: string;
  quantity: number;
  /**
   * The price charged per unit, snapshotted on the order item.
   *
   * Passed in rather than derived as lineTotal / quantity, because that
   * division does not always come back out: 2 units at a 2999 line total
   * rounds to 1500, and a receipt then reads "2 × $15.00 … $29.99". Integer
   * cents exist precisely so money is never reconstructed by arithmetic that
   * can round.
   */
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface ReceiptOrder {
  orderNumber: string;
  currency: Currency;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  items: ReceiptLine[];
  /**
   * Structurally compatible with `PostalAddress` in the db package, declared
   * here rather than imported so this file keeps no dependency on the schema —
   * these templates are pure and must stay unit-testable in isolation.
   */
  shippingAddress?: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode: string;
    country: string;
  } | null;
}

function money(cents: number, currency: Currency): string {
  return formatMoney(cents, currency);
}

function addressLines(address: NonNullable<ReceiptOrder['shippingAddress']>): string[] {
  return [
    address.name,
    address.line1,
    address.line2 ?? '',
    [address.city, address.region ?? ''].filter(Boolean).join(', '),
    address.postalCode,
    address.country,
  ].filter((line) => line.trim() !== '');
}

/**
 * The order receipt.
 *
 * Sent once, when the webhook settles the payment — never on the redirect back
 * from Flutterwave, which proves nothing about whether money moved.
 *
 * Amounts come from the order row, which snapshotted them at checkout. Nothing
 * here recalculates a total: a receipt that disagreed with the charge, because
 * a price was edited in admin in the meantime, would be worse than no receipt.
 */
export function orderReceipt({
  order,
  orderUrl,
}: {
  order: ReceiptOrder;
  orderUrl: string;
}): Mail {
  /*
   * Quantity goes on its own line beneath the title, not appended after it.
   *
   * Inline, a wrap lands between the title and the "× 2" and orphans the
   * quantity — which at 280px is where it wraps every time. On its own line it
   * reads the same at any width, and it doubles as the unit price, which an
   * inline "× 2" never told anyone.
   *
   * The amount column keeps `nowrap` (a price broken across lines is
   * unreadable) and the title column gets `word-break`, so a long title yields
   * rather than pushing the table wider than the screen.
   */
  const rows = order.items
    .map(
      (item) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${RULE};font-family:${UI_STACK};font-size:14px;line-height:1.45;color:${INK};word-break:break-word;">
${esc(item.titleSnapshot)}${
        item.quantity > 1
          ? `<br><span style="font-size:12px;color:${INK_MUTED};">${esc(
              item.quantity,
            )} × ${esc(money(item.unitPriceCents, order.currency))}</span>`
          : ''
      }
</td>
<td align="right" valign="top" style="padding:10px 0 10px 12px;border-bottom:1px solid ${RULE};font-family:${UI_STACK};font-size:14px;color:${INK};white-space:nowrap;">
${esc(money(item.lineTotalCents, order.currency))}
</td>
</tr>`,
    )
    .join('\n');

  const totalRow = (label: string, cents: number, strong = false) => `<tr>
<td style="padding:${strong ? '12px 0 0' : '6px 0 0'};font-family:${UI_STACK};font-size:${
    strong ? '15px' : '13px'
  };color:${strong ? INK : INK_MUTED};${strong ? 'font-weight:600;' : ''}white-space:nowrap;">${esc(
    label,
  )}</td>
<td align="right" style="padding:${strong ? '12px 0 0 12px' : '6px 0 0 12px'};font-family:${UI_STACK};font-size:${
    strong ? '15px' : '13px'
  };color:${strong ? INK : INK_MUTED};${strong ? 'font-weight:600;' : ''}white-space:nowrap;">${esc(
    money(cents, order.currency),
  )}</td>
</tr>`;

  const shipping = order.shippingAddress
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;background:${PAPER_DEEP};">
<tr><td style="padding:14px;font-family:${UI_STACK};font-size:13px;line-height:1.6;color:${INK};word-break:break-word;">
<strong style="display:block;margin-bottom:4px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${INK_MUTED};">Shipping to</strong>
${addressLines(order.shippingAddress).map(esc).join('<br>')}
</td></tr></table>`
    : '';

  return {
    subject: `Your ZHS Press order ${order.orderNumber}`,
    html: shell(
      heading('Thank you — your order is confirmed') +
        paragraph(
          `Order <strong>${esc(order.orderNumber)}</strong>. We will email you again when it ships.`,
        ) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
${rows}
${totalRow('Subtotal', order.subtotalCents)}
${totalRow('Shipping', order.shippingCents)}
${order.taxCents > 0 ? totalRow('Tax', order.taxCents) : ''}
${totalRow('Total paid', order.totalCents, true)}
</table>` +
        shipping +
        `<div style="margin-top:28px;">${button(orderUrl, 'View your order')}</div>` +
        muted('Questions about this order? Reply to this email and we will pick it up.'),
      {
        preheader: `Order ${order.orderNumber} — ${money(order.totalCents, order.currency)} paid.`,
      },
    ),
    text: [
      'Thank you — your order is confirmed.',
      '',
      `Order ${order.orderNumber}`,
      '',
      ...order.items.map(
        (item) =>
          `  ${item.titleSnapshot}${
            item.quantity > 1
              ? ` (${item.quantity} x ${money(item.unitPriceCents, order.currency)})`
              : ''
          }  ${money(item.lineTotalCents, order.currency)}`,
      ),
      '',
      `  Subtotal    ${money(order.subtotalCents, order.currency)}`,
      `  Shipping    ${money(order.shippingCents, order.currency)}`,
      ...(order.taxCents > 0 ? [`  Tax         ${money(order.taxCents, order.currency)}`] : []),
      `  Total paid  ${money(order.totalCents, order.currency)}`,
      '',
      ...(order.shippingAddress
        ? ['Shipping to:', ...addressLines(order.shippingAddress).map((line) => `  ${line}`), '']
        : []),
      `View your order: ${orderUrl}`,
      '',
      'Questions? Reply to this email and we will pick it up.',
      '',
      '— ZHS Press',
    ].join('\n'),
  };
}

/**
 * Sent when an order is marked fulfilled in admin.
 *
 * The receipt says "we will email you again when it ships", so this is the
 * message that keeps that promise. There is no tracking number: fulfilment is
 * still TBC per the brief, and inventing a field for one we cannot populate
 * would be worse than saying plainly that it has gone out.
 */
export function orderShipped({
  orderNumber,
  orderUrl,
}: {
  orderNumber: string;
  orderUrl: string;
}): Mail {
  return {
    subject: `Your ZHS Press order ${orderNumber} is on its way`,
    html: shell(
      heading('It is on its way') +
        paragraph(
          `Order <strong>${esc(orderNumber)}</strong> went out today. ` +
            'Post being post, give it a little time.',
        ) +
        button(orderUrl, 'View your order') +
        muted('Anything wrong when it arrives? Reply to this email.'),
      { preheader: `Order ${orderNumber} has shipped.` },
    ),
    text: [
      'It is on its way.',
      '',
      `Order ${orderNumber} went out today. Post being post, give it a little time.`,
      '',
      `View your order: ${orderUrl}`,
      '',
      'Anything wrong when it arrives? Reply to this email.',
      '',
      '— ZHS Press',
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export function submissionReceived({ name, title }: { name: string; title: string }): Mail {
  return {
    subject: 'We have your submission',
    html: shell(
      heading('We have it') +
        paragraph(
          `Thank you for sending <em>${esc(title)}</em>. It is with our editors now.`,
        ) +
        paragraph(
          'We read everything, and we aim to reply within six to eight weeks. ' +
            'If it has been longer than that, do write and chase us — it will not annoy us.',
        ) +
        muted('There is no need to reply to this message.'),
      { preheader: 'Your manuscript is with our editors.' },
    ),
    text: [
      `Dear ${name},`,
      '',
      `Thank you for sending "${title}". It is with our editors now.`,
      '',
      'We read everything, and we aim to reply within six to eight weeks. If it has',
      'been longer than that, do write and chase us — it will not annoy us.',
      '',
      '— ZHS Press',
    ].join('\n'),
  };
}

/**
 * Internal alert for a new submission.
 *
 * The synopsis is included in full so it can be triaged from the inbox, and
 * every field is escaped — this is the one template whose content is written by
 * an anonymous stranger and read by staff.
 */
export function submissionAlert({
  name,
  email,
  genre,
  title,
  synopsis,
  hasManuscript,
  adminUrl,
}: {
  name: string;
  email: string;
  genre: string;
  title: string;
  synopsis: string;
  hasManuscript: boolean;
  adminUrl: string;
}): Mail {
  /*
   * Label stacked above value, rather than a two-column table.
   *
   * Two columns need roughly 90px for the label before the value gets any
   * room, which on a 280px screen leaves an email address wrapping every few
   * characters. Stacking is fluid by construction and costs nothing on a wide
   * screen, where these are five short lines either way.
   *
   * `break-word` on the value because an email address is one long token with
   * no break opportunity, and it is the field most likely to overflow.
   */
  const field = (label: string, value: string) => `<div style="margin-bottom:10px;">
<div style="font-family:${UI_STACK};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_MUTED};">${esc(
    label,
  )}</div>
<div style="font-family:${UI_STACK};font-size:14px;line-height:1.4;color:${INK};word-break:break-word;">${esc(
    value,
  )}</div>
</div>`;

  return {
    subject: `New submission: ${title}`,
    html: shell(
      heading('New submission') +
        `<div style="margin:0 0 18px;">
${field('Title', title)}
${field('From', name)}
${field('Email', email)}
${field('Genre', genre)}
${field('Manuscript', hasManuscript ? 'Attached file uploaded' : 'None')}
</div>` +
        // pre-wrap keeps the writer's paragraph breaks; break-word stops a long
        // unbroken string from widening the frame.
        `<div style="padding:14px;background:${PAPER_DEEP};font-family:${UI_STACK};font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap;word-break:break-word;">${esc(
          synopsis,
        )}</div>` +
        `<div style="margin-top:24px;">${button(adminUrl, 'Open in admin')}</div>`,
      { preheader: `${title} — ${genre}, from ${name}.` },
    ),
    text: [
      'New submission',
      '',
      `Title:      ${title}`,
      `From:       ${name}`,
      `Email:      ${email}`,
      `Genre:      ${genre}`,
      `Manuscript: ${hasManuscript ? 'uploaded' : 'none'}`,
      '',
      synopsis,
      '',
      `Open in admin: ${adminUrl}`,
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Waitlist
// ---------------------------------------------------------------------------

/** Sent once, when a title someone asked about goes on sale. */
export function waitlistRelease({
  title,
  productUrl,
}: {
  title: string;
  productUrl: string;
}): Mail {
  return {
    subject: `${title} is available now`,
    html: shell(
      heading(`${title} is here`) +
        paragraph(
          `You asked us to let you know when <em>${esc(title)}</em> was available. It is.`,
        ) +
        button(productUrl, 'Have a look') +
        muted(
          'You are getting this because you asked to be notified about this one title. ' +
            'It is the only email we will send you about it.',
        ),
      { preheader: `${title} is available to order.` },
    ),
    text: [
      `${title} is here.`,
      '',
      `You asked us to let you know when "${title}" was available. It is.`,
      '',
      productUrl,
      '',
      'You are getting this because you asked to be notified about this one title.',
      'It is the only email we will send you about it.',
      '',
      '— ZHS Press',
    ].join('\n'),
  };
}
