import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import type { Env } from '../config/env';
import { DB } from '../db/db.module';
import { MailService } from '../mail/mail.service';
import { url, waitlistRelease } from '../mail/templates';

/** Sent per run. A larger list is picked up by the next status change. */
const BATCH_LIMIT = 200;

/**
 * The storefront route for a product.
 *
 * Every product type has its own section, and stationery lives under /shop —
 * there is no /books/journal-moss. Exhaustive rather than a two-way guess,
 * because the email's only call to action is this link, and a 404 wastes the
 * one message this person gets.
 */
export function productPath(product: { type: string; slug: string }): string {
  switch (product.type) {
    case 'magazine':
      return `magazine/${product.slug}`;
    case 'book':
      return `books/${product.slug}`;
    default:
      return `shop/${product.slug}`;
  }
}

/**
 * Notifies everyone who asked to hear when a title went on sale.
 *
 * This is the other half of the "notify me" form on an unreleased title (brief
 * 2.2). Without it, `waitlist_entries` is a table that only ever accumulates —
 * people ask to be told, and nothing tells them.
 *
 * The trigger is a status change to `available` in admin, which is the moment a
 * title genuinely goes on sale. There is no scheduled job: a cron would have to
 * poll for state changes it has no way to detect except by keeping its own
 * copy of every product's previous status.
 */
@Injectable()
export class WaitlistNotifier {
  private readonly logger = new Logger(WaitlistNotifier.name);

  /**
   * Products currently being notified.
   *
   * Two admins saving the same product in quick succession would otherwise
   * start two runs over the same rows, and `notifiedAt` is only written after a
   * send — so both runs would read the same unnotified entries and both would
   * mail them.
   */
  private readonly inFlight = new Set<number>();

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Does a status change warrant notifying the waitlist?
   *
   * Only a transition *into* `available`. Saving an already-available product —
   * fixing a typo in its blurb, reordering its images — must not re-mail
   * anyone, which is why the previous status is required rather than inferred.
   */
  static shouldNotify(previousStatus: string, nextStatus: string): boolean {
    return nextStatus === 'available' && previousStatus !== 'available';
  }

  /**
   * Starts a run without blocking the caller.
   *
   * A waitlist of several hundred means several hundred SMTP round trips. Doing
   * that inside the admin PUT would hold the request open for minutes and
   * eventually time out at the proxy — leaving the admin staring at an error for
   * a save that succeeded.
   *
   * Detaching is safe here specifically because this is a long-lived Nest
   * process, not a serverless function that is frozen the moment it responds.
   * The catch is not optional: an unhandled rejection in a detached promise
   * takes down the process under Node's default policy.
   */
  notifyInBackground(productId: number): void {
    void this.notify(productId).catch((error) => {
      this.logger.error(
        `Waitlist notification for product ${productId} failed: ${(error as Error).message}`,
        error as Error,
      );
    });
  }

  async notify(productId: number): Promise<{ sent: number; failed: number; skipped: boolean }> {
    if (this.inFlight.has(productId)) {
      this.logger.warn(`Waitlist run for product ${productId} already in progress; skipping.`);
      return { sent: 0, failed: 0, skipped: true };
    }

    this.inFlight.add(productId);
    try {
      const product = await this.db.query.products.findFirst({
        where: eq(schema.products.id, productId),
      });
      if (!product) return { sent: 0, failed: 0, skipped: true };

      const pending = await this.db.query.waitlistEntries.findMany({
        where: and(
          eq(schema.waitlistEntries.productId, productId),
          isNull(schema.waitlistEntries.notifiedAt),
        ),
        limit: BATCH_LIMIT,
      });

      if (pending.length === 0) return { sent: 0, failed: 0, skipped: false };

      this.logger.log(`Notifying ${pending.length} waitlist entr(ies) for ${product.title}`);

      const mail = waitlistRelease({
        title: product.title,
        productUrl: url(this.config.get('WEB_BASE_URL', { infer: true }), productPath(product)),
      });

      let sent = 0;
      let failed = 0;

      /*
       * Sequential, and `notifiedAt` written only after the send succeeds.
       *
       * Marking the whole batch up front would be one query instead of N, but a
       * relay failure halfway through would then leave people permanently
       * marked as notified having received nothing — and there is no way back
       * from that, because the only record that they were owed an email is the
       * null we just overwrote. Re-running after a partial failure is the
       * behaviour worth having.
       *
       * Sequential rather than parallel because providers rate-limit
       * connections, and a burst of 200 is how an account gets throttled.
       */
      for (const entry of pending) {
        const result = await this.mail.send(entry.email, mail, `waitlist: ${product.title}`);

        if (result.sent) {
          await this.db
            .update(schema.waitlistEntries)
            .set({ notifiedAt: new Date() })
            .where(eq(schema.waitlistEntries.id, entry.id));
          sent += 1;
        } else {
          failed += 1;
          // No transport at all: stop rather than log the same warning 200
          // times. Nothing has been marked, so a later run picks all of it up.
          if (result.reason === 'not_configured') break;
        }
      }

      this.logger.log(
        `Waitlist for ${product.title}: ${sent} sent, ${failed} failed` +
          (pending.length === BATCH_LIMIT ? `, batch capped at ${BATCH_LIMIT}` : ''),
      );

      return { sent, failed, skipped: false };
    } finally {
      this.inFlight.delete(productId);
    }
  }
}
