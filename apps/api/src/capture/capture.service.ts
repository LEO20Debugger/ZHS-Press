import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import type {
  CreateSubmissionInput,
  NewsletterSignupInput,
  WaitlistSignupInput,
} from '@zhs/shared';
import type { Env } from '../config/env';
import { DB } from '../db/db.module';
import { MailService } from '../mail/mail.service';
import {
  newsletterConfirmation,
  newsletterWelcome,
  submissionAlert,
  submissionReceived,
  url,
} from '../mail/templates';

function token(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class CaptureService {
  private readonly logger = new Logger(CaptureService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get webBaseUrl(): string {
    return this.config.get('WEB_BASE_URL', { infer: true });
  }

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

    /*
     * The welcome note carries the unsubscribe link.
     *
     * That is the point of sending it at all. Once someone is confirmed they
     * are on a list, and the way off it should be sitting in their inbox rather
     * than something they have to come back to the site to find. It also proves
     * to them that the opt-in actually completed, which the confirmation page
     * alone does not if they closed the tab.
     */
    await this.mail.send(
      subscriber.email,
      newsletterWelcome({
        unsubscribeUrl: url(
          this.webBaseUrl,
          `newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken ?? '')}`,
        ),
      }),
      'newsletter welcome',
    );

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

    const inserted = await this.db.insert(schema.submissions).values({
      name: input.name,
      email: input.email,
      genre: input.genre,
      title: input.title,
      synopsis: input.synopsis,
      manuscriptFileKey: manuscript?.fileKey ?? null,
      manuscriptFileName: manuscript?.fileName ?? null,
      status: 'new',
    });

    /*
     * Two emails, and the order matters: the row is already committed, so
     * neither failure can lose a submission.
     *
     * The acknowledgement is the one a writer will notice missing — sending a
     * manuscript into a form that says nothing back is the standard complaint
     * about small presses. The internal alert is what stops the queue being
     * something anyone has to remember to check.
     */
    await this.mail.send(
      input.email,
      submissionReceived({ name: input.name, title: input.title }),
      'submission acknowledgement',
    );

    const submissionId = Number(
      (inserted as unknown as { insertId?: number | string }).insertId ?? 0,
    );

    await this.mail.send(
      this.mail.pressAddress,
      submissionAlert({
        name: input.name,
        email: input.email,
        genre: input.genre,
        title: input.title,
        synopsis: input.synopsis,
        hasManuscript: Boolean(manuscript),
        // The list, not a detail route — there is no per-submission page, and a
        // link to one that 404s is worse than a link to the queue.
        adminUrl: url(this.webBaseUrl, 'admin/submissions'),
      }),
      submissionId ? `submission alert (#${submissionId})` : 'submission alert',
    );

    return { ok: true };
  }

  /**
   * The confirmation link points at the web app, not this API.
   *
   * The API endpoint answers with JSON, which is the wrong thing to put in
   * front of someone who just clicked a link in their email. The web page calls
   * the API and renders the outcome.
   */
  private async sendConfirmation(email: string, confirmToken: string): Promise<void> {
    const confirmUrl = url(
      this.webBaseUrl,
      `newsletter/confirm?token=${encodeURIComponent(confirmToken)}`,
    );

    await this.mail.send(email, newsletterConfirmation({ confirmUrl }), 'newsletter confirmation');
  }
}
