/**
 * Sandbox notice for the checkout page.
 *
 * Shown only when NEXT_PUBLIC_PAYMENTS_TEST_MODE is "true", which is set
 * alongside Flutterwave's FLWSECK_TEST_ keys. Two jobs:
 *
 *  1. Tell whoever is clicking that no money moves, so a demo is not mistaken
 *     for a real order — and hand them the card number, which is not something
 *     anyone should have to go and look up mid-demo.
 *  2. Make it loud when the site is NOT ready to take real money. A silent test
 *     mode is the failure that matters: live keys go in at launch, this var is
 *     forgotten, and the shop quietly accepts payments that never settle.
 *
 * Delete this component, the env var, and its import at launch.
 */
export function TestModeNotice() {
  if (process.env.NEXT_PUBLIC_PAYMENTS_TEST_MODE !== 'true') return null;

  return (
    <aside
      className="mt-8 border-l-2 border-terracotta bg-paper-raised px-5 py-4"
      aria-label="Test mode"
    >
      <p className="font-ui text-caption font-medium uppercase tracking-wide text-terracotta">
        Demonstration mode — no payment is taken
      </p>
      <p className="prose-editorial mt-2 text-small text-ink-muted">
        This shop is connected to Flutterwave&rsquo;s sandbox. You can complete a
        whole order and watch the receipt arrive, but no card is charged and no
        money moves. Use the test card below — a real card will be declined.
      </p>

      {/*
        A <dl> rather than a paragraph: these are four labelled values that get
        typed one at a time into four separate fields, and a screen reader
        announces each label with its value instead of one run-on sentence.
      */}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-ui text-caption">
        <dt className="text-ink-muted">Card</dt>
        <dd className="tabular-nums">5531 8866 5214 2950</dd>
        <dt className="text-ink-muted">Expiry</dt>
        <dd className="tabular-nums">09/32</dd>
        <dt className="text-ink-muted">CVV</dt>
        <dd className="tabular-nums">564</dd>
        <dt className="text-ink-muted">PIN / OTP</dt>
        <dd className="tabular-nums">3310 &middot; 12345</dd>
      </dl>
    </aside>
  );
}
