import { describe, expect, it } from 'vitest';
import { WaitlistNotifier, productPath } from './waitlist-notifier.service';

describe('WaitlistNotifier.shouldNotify', () => {
  it('fires when a coming_soon title goes on sale', () => {
    expect(WaitlistNotifier.shouldNotify('coming_soon', 'available')).toBe(true);
  });

  it('fires when a draft is published straight to available', () => {
    expect(WaitlistNotifier.shouldNotify('draft', 'available')).toBe(true);
  });

  it('does not fire when an available title is merely edited', () => {
    // The common case by far: fixing a blurb, reordering images, correcting a
    // price. Re-mailing the waitlist on every save is how a press gets blocked.
    expect(WaitlistNotifier.shouldNotify('available', 'available')).toBe(false);
  });

  it('does not fire on any other transition', () => {
    for (const [from, to] of [
      ['available', 'sold_out'],
      ['available', 'archived'],
      ['draft', 'coming_soon'],
      ['sold_out', 'coming_soon'],
    ] as const) {
      expect(WaitlistNotifier.shouldNotify(from, to), `${from} -> ${to}`).toBe(false);
    }
  });

  it('fires again if a sold-out title is restocked', () => {
    // Anyone who joined the waitlist while it was sold out has not been
    // notified yet — their entry still has a null notifiedAt — so this is the
    // transition that owes them the email.
    expect(WaitlistNotifier.shouldNotify('sold_out', 'available')).toBe(true);
  });
});

describe('productPath', () => {
  it('sends each type to its own section', () => {
    expect(productPath({ type: 'book', slug: 'soar' })).toBe('books/soar');
    expect(productPath({ type: 'magazine', slug: 'light-issue-4' })).toBe('magazine/light-issue-4');
    // Stationery has no section of its own; it lives in the unified shop.
    expect(productPath({ type: 'stationery', slug: 'journal-moss' })).toBe('shop/journal-moss');
  });

  it('falls back to the shop for an unknown type rather than guessing', () => {
    expect(productPath({ type: 'something-new', slug: 'x' })).toBe('shop/x');
  });
});
