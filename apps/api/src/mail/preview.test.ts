import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
  newsletterConfirmation,
  newsletterWelcome,
  orderReceipt,
  orderShipped,
  submissionAlert,
  submissionReceived,
  waitlistRelease,
  type Mail,
} from './templates';

/**
 * Renders every email to disk so they can be looked at in a browser.
 *
 * Excluded from the normal test run and driven by its own config, because it
 * writes files and asserts nothing:
 *
 *   pnpm mail:preview
 *
 * Output goes to apps/api/email-previews/ (git-ignored). Open index.html.
 *
 * A generated preview is not the same thing as a real send: an inbox applies
 * its own dark-mode inversion, link colouring and image blocking, and Outlook
 * re-renders the whole thing through Word. Use this to settle copy and layout,
 * then send one real message to a live address before launch.
 */

const SAMPLES: Array<{ file: string; label: string; mail: Mail }> = [
  {
    file: 'newsletter-confirmation',
    label: 'Newsletter — confirm subscription (double opt-in)',
    mail: newsletterConfirmation({
      confirmUrl: 'https://zhspress.org/newsletter/confirm?token=3f9a1c7e',
    }),
  },
  {
    file: 'newsletter-welcome',
    label: 'Newsletter — welcome, sent once confirmed',
    mail: newsletterWelcome({
      unsubscribeUrl: 'https://zhspress.org/newsletter/unsubscribe?token=8b2d4e6f',
    }),
  },
  {
    file: 'order-receipt',
    label: 'Order receipt — sent by the payment webhook',
    mail: orderReceipt({
      order: {
        orderNumber: 'ZHS-7F3K9Q',
        currency: 'USD',
        subtotalCents: 4899,
        shippingCents: 650,
        taxCents: 0,
        totalCents: 5549,
        items: [
          { titleSnapshot: 'Soar', quantity: 1, unitPriceCents: 1999, lineTotalCents: 1999 },
          { titleSnapshot: 'Light, Issue Four', quantity: 2, unitPriceCents: 1450, lineTotalCents: 2900 },
        ],
        shippingAddress: {
          name: 'Ada Okonkwo',
          line1: '14 Marina Road',
          line2: 'Flat 3',
          city: 'Lagos',
          region: 'Lagos State',
          postalCode: '101001',
          country: 'Nigeria',
        },
      },
      orderUrl: 'https://zhspress.org/order/ZHS-7F3K9Q',
    }),
  },
  {
    file: 'order-shipped',
    label: 'Order shipped — sent when an order is marked fulfilled in admin',
    mail: orderShipped({
      orderNumber: 'ZHS-7F3K9Q',
      orderUrl: 'https://zhspress.org/order/ZHS-7F3K9Q',
    }),
  },
  {
    file: 'submission-received',
    label: 'Submission — acknowledgement to the writer',
    mail: submissionReceived({ name: 'Ada Okonkwo', title: 'The Long Rain' }),
  },
  {
    file: 'submission-alert',
    label: 'Submission — internal alert to the press',
    mail: submissionAlert({
      name: 'Ada Okonkwo',
      email: 'ada@example.com',
      genre: 'fiction',
      title: 'The Long Rain',
      synopsis:
        'Two sisters return to the town they grew up in to bury their father, and find ' +
        'the house has been sold without either of them being told.\n\n' +
        'Literary fiction, roughly 74,000 words, complete.',
      hasManuscript: true,
      adminUrl: 'https://zhspress.org/admin/submissions',
    }),
  },
  {
    file: 'waitlist-release',
    label: 'Waitlist — a title someone asked about is now on sale',
    mail: waitlistRelease({
      title: 'TurnaSpurn',
      productUrl: 'https://zhspress.org/books/turnaspurn',
    }),
  },
];

describe('email previews', () => {
  it('writes every template to apps/api/email-previews/', () => {
    const outDir = join(process.cwd(), 'email-previews');
    mkdirSync(outDir, { recursive: true });

    for (const sample of SAMPLES) {
      writeFileSync(join(outDir, `${sample.file}.html`), sample.mail.html, 'utf8');
      writeFileSync(join(outDir, `${sample.file}.txt`), sample.mail.text, 'utf8');
    }

    /*
     * The index embeds each message in an iframe rather than linking to it.
     *
     * An iframe gives every email its own document, which is what a mail client
     * gives it too — inlining the bodies into one page would let the outer
     * page's styles leak in and show a layout no recipient will ever see.
     */
    const index = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZHS Press — email templates</title>
<style>
  body { margin:0; padding:36px 20px; background:#f4eee0; color:#1e2525;
         font:14px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrap { max-width: 1180px; margin: 0 auto; }
  h1 { font-family: Georgia, serif; font-size: 30px; font-weight: normal; margin: 0 0 6px; }
  .lede { color:#565c5c; margin: 0 0 24px; max-width: 64ch; }
  .bar { position: sticky; top: 0; z-index: 5; display:flex; flex-wrap:wrap; gap:8px;
         align-items:center; margin: 0 0 28px; padding: 12px 14px;
         background:#fffefa; border:1px solid #e2dccc; }
  .bar b { font-size:11px; letter-spacing:.1em; text-transform:uppercase;
           color:#565c5c; font-weight:600; margin-right:4px; }
  .bar button { font: inherit; font-size:13px; padding:7px 13px; cursor:pointer;
                background:#faf7f0; color:#1e2525; border:1px solid #e2dccc; }
  .bar button[aria-pressed="true"] { background:#b13f2f; color:#fffefa; border-color:#b13f2f; }
  .card { background:#fffefa; border:1px solid #e2dccc; margin-bottom: 26px; }
  .card h2 { margin:0; padding:13px 16px; border-bottom:1px solid #e2dccc;
             display:flex; flex-wrap:wrap; gap:6px; justify-content:space-between;
             font:600 12px/1.4 -apple-system, sans-serif; letter-spacing:.09em;
             text-transform:uppercase; color:#565c5c; }
  .card h2 span { font-weight:400; text-transform:none; letter-spacing:0; color:#1e2525; }
  .stage { display:flex; justify-content:center; background:#e8e1d2; padding:14px; }
  iframe { display:block; width:100%; max-width:100%; height:780px; border:0;
           background:#faf7f0; transition: width .18s ease; }
  details { border-top:1px solid #e2dccc; }
  summary { padding:10px 16px; cursor:pointer; font-size:12px; color:#565c5c; }
  pre { margin:0; padding:0 16px 16px; white-space:pre-wrap; font-size:12.5px; color:#1e2525; }
</style></head>
<body><div class="wrap">
<h1>ZHS Press — email templates</h1>
<p class="lede">${SAMPLES.length} transactional emails, rendered from the real template code.
Each sits in its own frame, as a mail client gives it. Use the widths below —
<strong>280px is a Galaxy Fold cover screen</strong>, the narrowest thing worth
designing for. Expand “plain text” for the alternative body that ships with
every one.</p>

<div class="bar">
  <b>Width</b>
  <button type="button" data-w="280">280 — Fold cover</button>
  <button type="button" data-w="360">360 — phone</button>
  <button type="button" data-w="414">414 — large phone</button>
  <button type="button" data-w="0" aria-pressed="true">Full width</button>
</div>

${SAMPLES.map(
  (sample) => `<div class="card">
<h2>${sample.label}<span>${sample.mail.subject}</span></h2>
<div class="stage">
<iframe title="${sample.label}" srcdoc="${sample.mail.html.replace(/"/g, '&quot;')}"></iframe>
</div>
<details><summary>plain text</summary><pre>${sample.mail.text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')}</pre></details>
</div>`,
).join('\n')}
</div>
<script>
  /*
   * Resizing the iframe, not the browser window, is what makes this useful:
   * the email's own media query keys off the frame width, so the narrow layout
   * can be checked on a desktop screen.
   */
  var buttons = document.querySelectorAll('.bar button');
  var frames = document.querySelectorAll('iframe');
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      buttons.forEach(function (other) { other.setAttribute('aria-pressed', 'false'); });
      button.setAttribute('aria-pressed', 'true');
      var width = Number(button.dataset.w);
      frames.forEach(function (frame) { frame.style.width = width ? width + 'px' : '100%'; });
    });
  });
</script>
</body></html>`;

    writeFileSync(join(outDir, 'index.html'), index, 'utf8');
    console.log(`\nWrote ${SAMPLES.length} previews to ${outDir}\n`);
  });
});
