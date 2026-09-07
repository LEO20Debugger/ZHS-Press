import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import type {
  CreateSubmissionInput,
  NewsletterSignupInput,
  WaitlistSignupInput,
} from '@zhs/shared';
import { DB } from '../db/db.module';

function token(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class CaptureService {
  private readonly logger = new Logger(CaptureService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Newsletter signup, double opt-in.
   *
   * Always resolves to the same "check your email" outcome regardless of
   * whether the address was already on the list. Telling an anonymous caller
   * "that email is already subscribed" turns the form into an oracle for
   * checking whether a given person reads this newsletter.
   */
  async subscribe(input: NewsletterSignupInput): Promise<{ ok: true }> {
    if (input.website) {
      // Honeypot filled: accept and discard, so the bot learns nothing.
      return { ok: true };
    }

    const existing = await this.db.query.newsletterSubscribers.findFirst({
      where: eq(schema.newsletterSubscribers.email, input.email),
    });

    if (existing) {
      if (existing.status === 'confirmed') {
        return { ok: true };
      }

      // Pending or previously unsubscribed: issue a fresh confirmation.
      const confirmToken = token();
      await this.db
        .update(schema.newsletterSubscribers)
        .set({ status: 'pending', confirmToken, unsubscribedAt: null })
        .where(eq(schema.newsletterSubscribers.id, existing.id));

      await this.sendConfirmation(input.email, confirmToken);
      return { ok: true };
    }

    const confirmToken = token();
    await this.db.insert(schema.newsletterSubscribers).values({
      email: input.email,
      status: 'pending',
      confirmToken,
      unsubscribeToken: token(),
      source: input.source ?? null,
    });

    await this.sendConfirmation(input.email, confirmToken);
    return { ok: true };
  }

  async confirmSubscription(confirmToken: string): Promise<{ ok: true }> {
    const subscriber = await this.db.query.newsletterSubscribers.findFirst({
      where: eq(schema.newsletterSubscribers.confirmToken, confirmToken),
    });

    if (!subscriber) {
      throw new NotFoundException('That confirmation link is no longer valid.');
    }

    await this.db
      .update(schema.newsletterSubscribers)
      .set({ status: 'confirmed', confirmedAt: new Date(), confirmToken: null })
      .where(eq(schema.newsletterSubscribers.id, subscriber.id));

    return { ok: true };
  }

  async unsubscribe(unsubscribeToken: string): Promise<{ ok: true }> {
    await this.db
      .update(schema.newsletterSubscribers)
      .set({ status: 'unsubscribed', unsubscribedAt: new Date() })
      .where(eq(schema.newsletterSubscribers.unsubscribeToken, unsubscribeToken));

    // Deliberately not a 404 on an unknown token: an unsubscribe link should
    // never fail in a way that leaves someone unable to get off the list.
    return { ok: true };
  }

  /** "Notify me" on an unreleased title (brief 2.2). */
  async joinWaitlist(input: WaitlistSignupInput): Promise<{ ok: true }> {
    if (input.website) return { ok: true };

    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, input.productId),
    });

    if (!product || product.status === 'draft' || product.status === 'archived') {
      throw new NotFoundException('That title is not accepting notifications.');
    }

    // The unique (product_id, email) index makes a double submit a no-op
    // rather than a duplicate row or a 500.
    await this.db
      .insert(schema.waitlistEntries)
      .values({ productId: input.productId, email: input.email })
      .onDuplicateKeyUpdate({ set: { email: input.email } });

    return { ok: true };
  }

  /** Manuscript submissions (brief 2.5). */
  async createSubmission(
    input: CreateSubmissionInput,
    manuscript?: { fileKey: string; fileName: string },
  ): Promise<{ ok: true }> {
    if (input.website) return { ok: true };

    await this.db.insert(schema.submissions).values({
      name: input.name,
      email: input.email,
      genre: input.genre,
      title: input.title,
      synopsis: input.synopsis,
      manuscriptFileKey: manuscript?.fileKey ?? null,
      manuscriptFileName: manuscript?.fileName ?? null,
      status: 'new',
    });

    return { ok: true };
  }

  private async sendConfirmation(email: string, confirmToken: string): Promise<void> {
    // TODO(phase-4): send through the mail transport once SMTP is configured.
    // Logged rather than silently dropped so the flow is testable end to end
    // before email delivery is wired up.
    this.logger.log(`Newsletter confirmation pending for ${email} (token ${confirmToken})`);
  }
}
