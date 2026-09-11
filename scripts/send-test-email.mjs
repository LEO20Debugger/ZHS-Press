#!/usr/bin/env node
/**
 * Sends the real templates, through the real transport, to a real inbox.
 *
 *   pnpm mail:send-test you@example.com          # all of them
 *   pnpm mail:send-test you@example.com receipt  # just one
 *
 * This is the only check that covers the part nothing else can: whether the
 * provider accepts the message and whether it lands in the inbox or in spam.
 * Unit tests prove the HTML is right, the preview page proves it looks right,
 * and neither of them can tell you your SPF record is missing.
 *
 * It uses apps/api/dist, so the npm script builds first — sending a template
 * that is one edit out of date would be worse than not testing at all.
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

/* ---- Environment -------------------------------------------------------- */

/**
 * A deliberately small .env reader.
 *
 * dotenv is not a direct dependency of this workspace and Node's --env-file
 * fails outright when the file is absent, which is a likely state here. Ten
 * lines buys a clear error message instead.
 */
function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const path = join(root, name);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue; // A real environment variable wins.
      process.env[key] = rawValue.trim().replace(/^["'](.*)["']$/s, '$1');
    }
  }
}

loadEnv();

const [, , recipient, only] = process.argv;

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!recipient || !recipient.includes('@')) {
  die('Usage: pnpm mail:send-test <your@email.com> [template]');
}

if (!process.env.RESEND_API_KEY && !process.env.SMTP_URL) {
  die(
    'Neither RESEND_API_KEY nor SMTP_URL is set in .env — nothing to send through.\n' +
      '  See docs/email.md. For Resend:\n' +
      '    RESEND_API_KEY="re_YOUR_KEY"',
  );
}

const distPath = join(root, 'apps/api/dist/mail/mail.service.js');
if (!existsSync(distPath)) {
  die('apps/api/dist is missing. Run: pnpm --filter @zhs/api build');
}

const { MailService, parseSmtpUrl } = require(distPath);
const t = require(join(root, 'apps/api/dist/mail/templates.js'));

/* ---- The messages ------------------------------------------------------- */

const ORDER_URL = `${process.env.WEB_BASE_URL ?? 'http://localhost:3000'}/order/ZHS-TEST01`;

const TEMPLATES = {
  confirm: () =>
    t.newsletterConfirmation({
      confirmUrl: `${process.env.WEB_BASE_URL ?? 'http://localhost:3000'}/newsletter/confirm?token=test-token`,
    }),
  welcome: () =>
    t.newsletterWelcome({
      unsubscribeUrl: `${process.env.WEB_BASE_URL ?? 'http://localhost:3000'}/newsletter/unsubscribe?token=test-token`,
    }),
  receipt: () =>
    t.orderReceipt({
      order: {
        orderNumber: 'ZHS-TEST01',
        currency: 'USD',
        subtotalCents: 4899,
        shippingCents: 650,
        taxCents: 0,
        totalCents: 5549,
        items: [
          { titleSnapshot: 'Soar', quantity: 1, unitPriceCents: 1999, lineTotalCents: 1999 },
          {
            titleSnapshot: 'Light, Issue Four',
            quantity: 2,
            unitPriceCents: 1450,
            lineTotalCents: 2900,
          },
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
      orderUrl: ORDER_URL,
    }),
  shipped: () => t.orderShipped({ orderNumber: 'ZHS-TEST01', orderUrl: ORDER_URL }),
  submission: () => t.submissionReceived({ name: 'Ada Okonkwo', title: 'The Long Rain' }),
  alert: () =>
    t.submissionAlert({
      name: 'Ada Okonkwo',
      email: 'ada@example.com',
      genre: 'fiction',
      title: 'The Long Rain',
      synopsis:
        'Two sisters return to the town they grew up in to bury their father, and find\n' +
        'the house has been sold without either of them being told.\n\n' +
        'Literary fiction, roughly 74,000 words, complete.',
      hasManuscript: true,
      adminUrl: `${process.env.WEB_BASE_URL ?? 'http://localhost:3000'}/admin/submissions`,
    }),
  waitlist: () =>
    t.waitlistRelease({
      title: 'TurnaSpurn',
      productUrl: `${process.env.WEB_BASE_URL ?? 'http://localhost:3000'}/books/turnaspurn`,
    }),
};

if (only && !TEMPLATES[only]) {
  die(`Unknown template "${only}". One of: ${Object.keys(TEMPLATES).join(', ')}`);
}

const chosen = only ? [only] : Object.keys(TEMPLATES);

/* ---- Send --------------------------------------------------------------- */

const config = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM ?? 'ZHS Press <onboarding@resend.dev>',
  MAIL_REPLY_TO: process.env.MAIL_REPLY_TO,
  NODE_ENV: 'development',
};

// Printed before anything is sent, because "which transport am I even using"
// is the first question when mail does not arrive.
if (config.RESEND_API_KEY) {
  console.log('\n  Transport  Resend HTTPS API (api.resend.com)');
} else {
  const parsed = parseSmtpUrl(config.SMTP_URL);
  const tls = parsed.secure ? 'implicit TLS' : 'STARTTLS';
  console.log(`\n  Transport  SMTP ${parsed.host}:${parsed.port} (${tls})`);
  console.log('             Railway blocks SMTP below Pro — use RESEND_API_KEY there.');
}

console.log(`  From       ${config.MAIL_FROM}`);
console.log(`  To         ${recipient}\n`);

const mail = new MailService({ get: (key) => config[key] });

// Fails fast on a bad host, port or password, before sending anything.
await mail.verifyTransport();

let sent = 0;
let failed = 0;

for (const name of chosen) {
  const message = TEMPLATES[name]();
  const result = await mail.send(recipient, message, `test: ${name}`);
  if (result.sent) sent += 1;
  else failed += 1;
}

await mail.onApplicationShutdown();

console.log(`\n  ${sent} sent, ${failed} failed.\n`);

if (failed > 0) {
  console.log('  "domain is not verified"  -> set MAIL_FROM to onboarding@resend.dev,');
  console.log('                               or verify the domain at resend.com/domains.');
  console.log('  "your own email address"  -> unverified accounts can only send to the');
  console.log('                               address the Resend account was created with.');
  console.log('  "API key is invalid"      -> check RESEND_API_KEY.');
  console.log('  timed out                 -> SMTP is blocked; use RESEND_API_KEY.\n');
  process.exit(1);
}

console.log('  Check the inbox, and check spam. Landing in spam is an SPF/DKIM');
console.log('  problem on the sending domain, not a problem with this code.\n');
