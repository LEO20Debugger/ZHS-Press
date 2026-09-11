import { afterEach, describe, expect, it } from 'vitest';
import { parseSmtpUrl } from './mail.service';
import {
  configureBrand,
  newsletterConfirmation,
  newsletterWelcome,
  orderReceipt,
  orderShipped,
  submissionAlert,
  submissionReceived,
  url,
  waitlistRelease,
  type Mail,
  type ReceiptOrder,
} from './templates';

const ORDER: ReceiptOrder = {
  orderNumber: 'ZHS-7F3K9Q',
  currency: 'USD',
  // Internally consistent on purpose: 1999 + (2 × 1450) = 4899, + 650 shipping
  // = 5549. A fixture whose lines do not add up hides exactly the arithmetic
  // bug these assertions exist to catch.
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
    city: 'Lagos',
    postalCode: '101001',
    country: 'Nigeria',
  },
};

/** Every template, so the cross-cutting assertions below cannot miss one. */
const ALL: Array<[string, Mail]> = [
  ['newsletterConfirmation', newsletterConfirmation({ confirmUrl: 'https://zhspress.org/c?token=a' })],
  ['newsletterWelcome', newsletterWelcome({ unsubscribeUrl: 'https://zhspress.org/u?token=b' })],
  ['orderReceipt', orderReceipt({ order: ORDER, orderUrl: 'https://zhspress.org/order/ZHS-7F3K9Q' })],
  [
    'orderShipped',
    orderShipped({ orderNumber: 'ZHS-7F3K9Q', orderUrl: 'https://zhspress.org/order/ZHS-7F3K9Q' }),
  ],
  ['submissionReceived', submissionReceived({ name: 'Ada', title: 'The Long Rain' })],
  [
    'submissionAlert',
    submissionAlert({
      name: 'Ada',
      email: 'ada@example.com',
      genre: 'fiction',
      title: 'The Long Rain',
      synopsis: 'A novel.',
      hasManuscript: true,
      adminUrl: 'https://zhspress.org/admin/submissions',
    }),
  ],
  [
    'waitlistRelease',
    waitlistRelease({ title: 'TurnaSpurn', productUrl: 'https://zhspress.org/books/turnaspurn' }),
  ],
];

describe('every template', () => {
  for (const [name, mail] of ALL) {
    describe(name, () => {
      it('has a subject that is neither empty nor absurdly long', () => {
        expect(mail.subject.length).toBeGreaterThan(0);
        // Past roughly 78 characters clients truncate, and the truncation
        // usually lands mid-word.
        expect(mail.subject.length).toBeLessThanOrEqual(78);
      });

      it('ships a plain-text body', () => {
        // Not cosmetic: a missing text/plain part measurably hurts
        // deliverability, and some gateways strip HTML entirely.
        expect(mail.text.trim().length).toBeGreaterThan(40);
        expect(mail.text).not.toContain('<');
      });

      it('uses no raw white or black', () => {
        // The same rule scripts/check-raw-colors.mjs enforces in CSS. It cannot
        // see these strings, so it is asserted here instead.
        expect(mail.html).not.toMatch(/#fff(fff)?\b/i);
        expect(mail.html).not.toMatch(/#000(000)?\b/i);
      });

      it('sets a preheader distinct from the wordmark', () => {
        // Without one, clients scrape the first text in the body — the
        // wordmark — so every message previews identically as "ZHS Press".
        const preheader = /opacity:0;overflow:hidden;">([^<]*)</.exec(mail.html)?.[1];
        expect(preheader, 'no preheader block found').toBeTruthy();
        expect(preheader!.trim().length).toBeGreaterThan(10);
      });

      it('leaves no unresolved template expression', () => {
        // Catches a literal "${...}" reaching a recipient through a quoting slip.
        expect(mail.html).not.toContain('${');
        expect(mail.text).not.toContain('${');
      });
    });
  }
});

/*
 * Narrow-screen structure.
 *
 * A browser can be resized to check these once; a test keeps them true. The
 * target is 280px — a Galaxy Fold's cover screen — which is narrower than any
 * breakpoint most layouts bother with, and where a fixed width or an unbreakable
 * token produces horizontal scrolling in a mail client that offers no way to
 * zoom out.
 */
/**
 * Drops HTML comments before matching.
 *
 * The shell carries a comment explaining why `width="560"` is never used, and
 * the naive check flagged the explanation as the violation. Prose about markup
 * is not markup — the same reason scripts/check-raw-colors.mjs strips comments
 * before looking for raw hex.
 */
function markup(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

describe('narrow screens', () => {
  for (const [name, mail] of ALL) {
    describe(name, () => {
      it('pins no element to a fixed pixel width', () => {
        // Outlook honours a width attribute over the stylesheet, so a numeric
        // one forces the full frame into a 280px screen.
        const fixedAttr = markup(mail.html).match(/width="(\d+)"/g) ?? [];
        expect(fixedAttr, `fixed width attribute(s): ${fixedAttr.join(', ')}`).toHaveLength(0);

        const fixedCss = markup(mail.html).match(/[^-]width:\s*\d+px/g) ?? [];
        expect(fixedCss, `fixed css width(s): ${fixedCss.join(', ')}`).toHaveLength(0);
      });

      it('constrains the frame with max-width instead', () => {
        expect(mail.html).toContain('max-width:560px');
      });

      it('carries a viewport meta', () => {
        expect(mail.html).toContain('width=device-width');
      });

      it('states its padding inline at the narrow value, widening by media query', () => {
        // Mobile-first matters here because some clients strip <style>: those
        // recipients get whatever is inline, so inline must be the safe one.
        const cardInline = /class="card" style="[^"]*padding:(\d+)px/.exec(mail.html);
        expect(cardInline, 'no .card padding found').toBeTruthy();
        expect(Number(cardInline![1])).toBeLessThanOrEqual(24);
        expect(mail.html).toMatch(/@media screen and \(min-width: 480px\)/);
      });

      it('never sets nowrap on a run of user-supplied text', () => {
        // nowrap belongs on money and short labels only. On a title or an email
        // address it is what pushes the frame past the screen edge.
        const nowrapCells = mail.html.match(/white-space:nowrap;">\s*([^<]{40,})/g) ?? [];
        expect(nowrapCells, `long nowrap runs: ${nowrapCells.join(' | ')}`).toHaveLength(0);
      });
    });
  }

  it('lets a long unbroken title yield rather than widen the frame', () => {
    const mail = orderReceipt({
      order: {
        ...ORDER,
        items: [
          {
            titleSnapshot: 'Antidisestablishmentarianism'.repeat(3),
            quantity: 1,
            unitPriceCents: 1999,
            lineTotalCents: 1999,
          },
        ],
      },
      orderUrl: 'https://x.test/o',
    });
    expect(mail.html).toContain('word-break:break-word');
  });

  it('lets a long email address in the submission alert break', () => {
    const mail = submissionAlert({
      name: 'A',
      email: 'a.very.long.address.indeed@some-extremely-long-domain-name.example.com',
      genre: 'fiction',
      title: 'T',
      synopsis: 'S',
      hasManuscript: false,
      adminUrl: 'https://x.test/a',
    });
    // An address is one token with no break opportunity, so it needs the hint.
    expect(mail.html).toContain('word-break:break-word');
  });
});

describe('brand logo in the masthead', () => {
  // Every other test in this file runs against the unconfigured default, so the
  // wordmark is restored after each case here.
  afterEach(() => configureBrand(null));

  it('uses the text wordmark when no base URL is configured', () => {
    configureBrand(null);
    const html = newsletterConfirmation({ confirmUrl: 'https://x.test/c' }).html;
    expect(html).toContain('ZHS&nbsp;Press');
    expect(html).not.toContain('logo-email.png');
  });

  it('uses the PNG logo when configured, never the SVG', () => {
    // No major mail client renders SVG, so the sharp vector used on the site is
    // useless here — this must be the raster.
    configureBrand('https://zhspress.org');
    const html = newsletterConfirmation({ confirmUrl: 'https://x.test/c' }).html;
    expect(html).toContain('https://zhspress.org/brand/logo-email.png');
    expect(html).not.toContain('.svg');
  });

  it('strips a trailing slash rather than producing a doubled one', () => {
    configureBrand('https://zhspress.org/');
    expect(newsletterConfirmation({ confirmUrl: 'https://x.test/c' }).html).toContain(
      'https://zhspress.org/brand/logo-email.png',
    );
  });

  it('carries alt text styled like the wordmark it replaces', () => {
    /*
     * Outlook desktop and many corporate gateways block images by default, so
     * the alt text is what a real share of recipients see. Typed like the
     * wordmark, a blocked image still reads as ZHS PRESS in letterspaced caps
     * instead of as a broken-image label.
     */
    configureBrand('https://zhspress.org');
    const html = newsletterConfirmation({ confirmUrl: 'https://x.test/c' }).html;
    const img = /<img[^>]*logo-email\.png[^>]*>/.exec(html)?.[0] ?? '';
    expect(img).toContain('alt="ZHS Press"');
    expect(img).toContain('text-transform:uppercase');
    expect(img).toContain('letter-spacing');
  });

  it('sets width and height as attributes so a blocked image still reserves space', () => {
    configureBrand('https://zhspress.org');
    const img =
      /<img[^>]*logo-email\.png[^>]*>/.exec(
        newsletterConfirmation({ confirmUrl: 'https://x.test/c' }).html,
      )?.[0] ?? '';
    expect(img).toMatch(/width="\d+"/);
    expect(img).toMatch(/height="\d+"/);
  });

  it('is narrow enough for a 280px screen', () => {
    /*
     * The narrow-screen suite above cannot catch this: it builds its messages
     * once at module load, before any base URL is set, so it only ever sees the
     * wordmark. The logo carries a fixed width attribute by design — a blocked
     * image needs it to reserve space — so the width itself has to be checked.
     *
     * 280px screen minus the frame's 10px and the card's 16px of padding on
     * each side leaves 228px of content.
     */
    configureBrand('https://zhspress.org');
    const img =
      /<img[^>]*logo-email\.png[^>]*>/.exec(
        newsletterConfirmation({ confirmUrl: 'https://x.test/c' }).html,
      )?.[0] ?? '';
    const width = Number(/width="(\d+)"/.exec(img)?.[1] ?? 0);
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(228);
  });

  it('reaches every template, not just the one under test', () => {
    configureBrand('https://zhspress.org');
    for (const build of [
      () => newsletterWelcome({ unsubscribeUrl: 'https://x.test/u' }),
      () => orderReceipt({ order: ORDER, orderUrl: 'https://x.test/o' }),
      () => orderShipped({ orderNumber: 'ZHS-1', orderUrl: 'https://x.test/o' }),
      () => submissionReceived({ name: 'A', title: 'T' }),
      () => waitlistRelease({ title: 'T', productUrl: 'https://x.test/p' }),
    ]) {
      expect(build().html).toContain('logo-email.png');
    }
  });
});

describe('escaping', () => {
  it('neutralises markup in a submission synopsis', () => {
    const mail = submissionAlert({
      name: '<script>alert(1)</script>',
      email: 'a@b.com',
      genre: 'fiction',
      title: 'Bears & Bees <3',
      synopsis: '<img src=x onerror="alert(1)">',
      hasManuscript: false,
      adminUrl: 'https://zhspress.org/admin/submissions',
    });

    // This is the sharpest case in the file: the content is written by an
    // anonymous stranger through a public form and read by staff.
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('Bears &amp; Bees &lt;3');
  });

  it('escapes a product title in the subject-adjacent body but not the subject', () => {
    const mail = waitlistRelease({ title: 'Rain & Ruin', productUrl: 'https://x.test/p' });
    // A subject is a header, not markup — escaping it would show the entity.
    expect(mail.subject).toBe('Rain & Ruin is available now');
    expect(mail.html).toContain('Rain &amp; Ruin');
  });

  it('escapes a quote so it cannot break out of an attribute', () => {
    const mail = waitlistRelease({
      title: 'ok',
      productUrl: 'https://x.test/p?a="onmouseover="alert(1)',
    });
    expect(mail.html).not.toContain('"onmouseover="');
    expect(mail.html).toContain('&quot;');
  });
});

describe('order receipt', () => {
  const mail = orderReceipt({
    order: ORDER,
    orderUrl: 'https://zhspress.org/order/ZHS-7F3K9Q',
  });

  it('shows every line and the total actually charged', () => {
    expect(mail.html).toContain('Soar');
    expect(mail.html).toContain('Light, Issue Four');
    expect(mail.html).toContain('$19.99');
    expect(mail.html).toContain('$29.00');
    expect(mail.html).toContain('$6.50');
    expect(mail.html).toContain('$55.49');
  });

  it('breaks a multiple quantity out as "n × unit price"', () => {
    expect(mail.html).toMatch(/Light, Issue Four.*2 × \$14\.50/s);
    expect(mail.text).toContain('(2 x $14.50)');
  });

  it('leaves a quantity of one unmarked', () => {
    // "1 × $19.99" beside a $19.99 line total is noise.
    expect(mail.html).not.toMatch(/Soar.*1 ×/s);
    expect(mail.text).not.toMatch(/Soar.*\(1 x/);
  });

  it('shows a unit price that multiplies back to the line total', () => {
    // The reason unitPriceCents is passed in rather than derived by division:
    // lineTotal / quantity rounds, and a receipt reading "2 × $15.00 … $29.99"
    // is the kind of thing a customer photographs and emails to you.
    for (const item of ORDER.items) {
      expect(item.unitPriceCents * item.quantity).toBe(item.lineTotalCents);
    }
  });

  it('has a total equal to its own subtotal plus shipping and tax', () => {
    const lines = ORDER.items.reduce((sum, item) => sum + item.lineTotalCents, 0);
    expect(lines).toBe(ORDER.subtotalCents);
    expect(ORDER.subtotalCents + ORDER.shippingCents + ORDER.taxCents).toBe(ORDER.totalCents);
  });

  it('hides the tax row while tax is zero', () => {
    // The column exists so enabling tax is not a migration, but a "$0.00 tax"
    // line on every receipt invites the question it cannot answer.
    expect(mail.html).not.toContain('Tax');
    expect(mail.text).not.toContain('Tax');
  });

  it('shows the tax row once tax is non-zero', () => {
    const taxed = orderReceipt({
      order: { ...ORDER, taxCents: 450, totalCents: 5999 },
      orderUrl: 'https://x.test/o',
    });
    expect(taxed.html).toContain('Tax');
    expect(taxed.html).toContain('$4.50');
  });

  it('renders the full address, name included', () => {
    for (const part of ['Ada Okonkwo', '14 Marina Road', 'Lagos', '101001', 'Nigeria']) {
      expect(mail.html).toContain(part);
      expect(mail.text).toContain(part);
    }
  });

  it('omits the address block when there is none', () => {
    const noAddress = orderReceipt({
      order: { ...ORDER, shippingAddress: null },
      orderUrl: 'https://x.test/o',
    });
    expect(noAddress.html).not.toContain('Shipping to');
    expect(noAddress.text).not.toContain('Shipping to');
  });

  it('puts the order number in the subject', () => {
    // It is the one thing a customer searches their inbox for.
    expect(mail.subject).toContain('ZHS-7F3K9Q');
  });

  it('never renders a money value as NaN or undefined', () => {
    expect(mail.html).not.toMatch(/NaN|undefined|\$Infinity/);
    expect(mail.text).not.toMatch(/NaN|undefined/);
  });
});

describe('action links', () => {
  it('repeats the link as readable text beside the button', () => {
    const link = 'https://zhspress.org/newsletter/confirm?token=abc123';
    const mail = newsletterConfirmation({ confirmUrl: link });

    // Once in the href, once as visible text — for clients that strip anchors
    // and for recipients who want to read a link before clicking it.
    const occurrences = mail.html.split(link).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    expect(mail.text).toContain(link);
  });
});

describe('url', () => {
  it('joins without doubling or dropping a slash', () => {
    expect(url('https://zhspress.org', 'a/b')).toBe('https://zhspress.org/a/b');
    expect(url('https://zhspress.org/', 'a/b')).toBe('https://zhspress.org/a/b');
    expect(url('https://zhspress.org//', '/a/b')).toBe('https://zhspress.org/a/b');
  });

  it('keeps a query string intact', () => {
    expect(url('https://zhspress.org/', 'newsletter/confirm?token=x')).toBe(
      'https://zhspress.org/newsletter/confirm?token=x',
    );
  });
});

describe('parseSmtpUrl', () => {
  it('treats smtps as implicit TLS on 465', () => {
    expect(parseSmtpUrl('smtps://user:pass@smtp.resend.com')).toEqual({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'user', pass: 'pass' },
    });
  });

  it('treats smtp on 587 as STARTTLS, not implicit TLS', () => {
    // secure:true on 587 waits for a TLS handshake on a plaintext socket and
    // hangs rather than erroring, which is a miserable thing to debug.
    const parsed = parseSmtpUrl('smtp://user:pass@smtp.provider.com:587');
    expect(parsed.secure).toBe(false);
    expect(parsed.port).toBe(587);
  });

  it('honours an explicit port', () => {
    expect(parseSmtpUrl('smtps://u:p@host:2465').port).toBe(2465);
  });

  it('decodes a percent-encoded password', () => {
    // Provider passwords contain @ / + routinely, so they arrive encoded. Not
    // decoding them fails authentication with a password that looks right.
    const parsed = parseSmtpUrl('smtps://user%40zhspress.org:p%40ss%2Fword@smtp.host.com');
    expect(parsed.auth).toEqual({ user: 'user@zhspress.org', pass: 'p@ss/word' });
  });

  it('parses a Resend URL, whose username is the literal word "resend"', () => {
    // Resend authenticates with user "resend" and the API key as the password —
    // not an email address, which is what every other provider uses.
    expect(parseSmtpUrl('smtp://resend:re_abc123@smtp.resend.com:587')).toEqual({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: { user: 'resend', pass: 're_abc123' },
    });
  });

  it('parses Resend\'s alternate ports without treating them as implicit TLS', () => {
    // 2587 is STARTTLS and 2465 is implicit, mirroring 587/465. Resend
    // publishes the alternates for networks that block the standard ones.
    expect(parseSmtpUrl('smtp://resend:k@smtp.resend.com:2587').secure).toBe(false);
    expect(parseSmtpUrl('smtps://resend:k@smtp.resend.com:2465').secure).toBe(true);
  });

  it('allows a relay with no credentials', () => {
    expect(parseSmtpUrl('smtp://localhost:1025').auth).toBeUndefined();
  });

  it('rejects a value that is not a URL, naming what it expected', () => {
    expect(() => parseSmtpUrl('smtp.resend.com')).toThrow(/valid URL/);
  });
});
