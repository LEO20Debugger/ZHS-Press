import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import { DB } from '../db/db.module';
import { AuditService } from './audit.service';
import { toCsv } from './csv';
import type { AdminPrincipal } from '../auth/auth.service';

/**
 * Who is waiting to hear from the press.
 *
 * Both tables were being written to and read by nobody: people could join a
 * waitlist or subscribe, and there was no way to see that they had.
 *
 * Almost entirely reads. The one write is `deleteSubscriber`, and the
 * distinction it turns on is worth stating: *unsubscribing* is the
 * subscriber's own act, through the link in their email, and leaves the row
 * behind — while *deleting* erases the record, which is what a request to be
 * removed actually asks for. An admin cannot do the first and should be able
 * to do the second.
 */
@Injectable()
export class AudienceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /* ---- Waitlist -------------------------------------------------------- */

  /** Per-title counts, so it is obvious which release people are waiting on. */
  async waitlistSummary() {
    return this.db
      .select({
        productId: schema.waitlistEntries.productId,
        title: schema.products.title,
        slug: schema.products.slug,
        status: schema.products.status,
        total: count(schema.waitlistEntries.id),
        // Who has not yet been told the title is out. This is the number that
        // matters when a release is imminent.
        waiting: sql<number>`SUM(CASE WHEN ${schema.waitlistEntries.notifiedAt} IS NULL THEN 1 ELSE 0 END)`,
      })
      .from(schema.waitlistEntries)
      .innerJoin(schema.products, eq(schema.waitlistEntries.productId, schema.products.id))
      .groupBy(
        schema.waitlistEntries.productId,
        schema.products.title,
        schema.products.slug,
        schema.products.status,
      )
      .orderBy(desc(count(schema.waitlistEntries.id)));
  }

  async waitlistEntries(productId?: number) {
    const filters = productId ? [eq(schema.waitlistEntries.productId, productId)] : [];

    return this.db.query.waitlistEntries.findMany({
      where: filters.length ? and(...filters) : undefined,
      orderBy: [desc(schema.waitlistEntries.createdAt)],
      limit: 500,
      with: { product: { columns: { title: true, slug: true } } },
    });
  }

  async waitlistCsv(productId?: number): Promise<string> {
    const entries = await this.waitlistEntries(productId);

    return toCsv(
      ['email', 'title', 'joined', 'notified'],
      entries.map((entry) => [
        entry.email,
        entry.product?.title ?? '',
        entry.createdAt.toISOString(),
        entry.notifiedAt ? entry.notifiedAt.toISOString() : '',
      ]),
    );
  }

  /* ---- Newsletter ------------------------------------------------------ */

  async subscriberSummary() {
    const rows = await this.db
      .select({ status: schema.newsletterSubscribers.status, total: count() })
      .from(schema.newsletterSubscribers)
      .groupBy(schema.newsletterSubscribers.status);

    const byStatus = Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));

    return {
      confirmed: byStatus.confirmed ?? 0,
      // Pending means the confirmation email was sent and not yet clicked.
      // A large and growing number here is the signal that email delivery is
      // broken, which is otherwise invisible.
      pending: byStatus.pending ?? 0,
      unsubscribed: byStatus.unsubscribed ?? 0,
    };
  }

  async subscribers(status?: string) {
    return this.db.query.newsletterSubscribers.findMany({
      where: status ? eq(schema.newsletterSubscribers.status, status as 'confirmed') : undefined,
      orderBy: [desc(schema.newsletterSubscribers.createdAt)],
      limit: 500,
      /*
       * Columns are listed rather than taken wholesale, to keep the tokens out.
       * `confirmToken` and `unsubscribeToken` are bearer credentials — anyone
       * holding one can confirm or unsubscribe that address — and they have no
       * business being in an admin response or a downloaded spreadsheet.
       */
      columns: {
        id: true,
        email: true,
        status: true,
        source: true,
        confirmedAt: true,
        unsubscribedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Export for a mailing tool.
   *
   * Confirmed addresses only, and not optional. An export that quietly included
   * `pending` rows would be an export of people who never completed double
   * opt-in — mailing them is the exact thing double opt-in exists to prevent,
   * and the mistake would be invisible at the moment it was made.
   */
  async subscriberCsv(): Promise<string> {
    const rows = await this.subscribers('confirmed');

    return toCsv(
      ['email', 'source', 'confirmed'],
      rows.map((row) => [row.email, row.source ?? '', row.confirmedAt?.toISOString() ?? '']),
    );
  }

  /**
   * Erases a subscriber outright.
   *
   * A hard delete, not a status change, because the two mean different things
   * and only one of them is this method's job:
   *
   * - **Unsubscribing** keeps the row and marks it `unsubscribed`. That is the
   *   subscriber's own act, through the link in their email, and the row has to
   *   survive so a later signup does not silently re-add someone who opted out.
   * - **Deleting** removes the record. That is what a "please remove my data"
   *   request means, and a soft delete would not satisfy it.
   *
   * The audit entry records the id and nothing else. Writing the email address
   * into an audit log at the moment someone asks to be erased would defeat the
   * erasure — the address would simply live on in a different table.
   */
  async deleteSubscriber(id: number, actor: AdminPrincipal) {
    const existing = await this.db.query.newsletterSubscribers.findFirst({
      where: eq(schema.newsletterSubscribers.id, id),
      columns: { id: true, status: true },
    });

    if (!existing) throw new NotFoundException('That subscriber no longer exists.');

    await this.db
      .delete(schema.newsletterSubscribers)
      .where(eq(schema.newsletterSubscribers.id, id));

    await this.audit.record(actor, 'subscriber.delete', 'subscriber', String(id), {
      status: { from: existing.status, to: null },
    });

    return { ok: true as const };
  }

  /** Titles with people still waiting — surfaced on the dashboard. */
  async pendingNotifications() {
    const [row] = await this.db
      .select({ total: count() })
      .from(schema.waitlistEntries)
      .where(isNull(schema.waitlistEntries.notifiedAt));

    return Number(row?.total ?? 0);
  }
}
