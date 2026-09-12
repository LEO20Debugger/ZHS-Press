import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, isNotNull } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import type { UpsertPageInput } from '@zhs/shared';
import { DB } from '../db/db.module';
import { AuditService } from './audit.service';
import type { AdminPrincipal } from '../auth/auth.service';

/**
 * Editorial pages — About, Submissions, policies.
 *
 * These routes exist so copy is not a code deploy. The storefront treats what
 * it finds here as an override: a page that is absent or unpublished leaves the
 * route rendering whatever it already shipped, so drafting new copy never
 * replaces what visitors currently see, and a mistake is one unpublish away
 * from being undone.
 */
@Injectable()
export class PagesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.db.query.pages.findMany({
      orderBy: [asc(schema.pages.slug)],
      columns: { id: true, slug: true, title: true, publishedAt: true, updatedAt: true },
    });
  }

  async findBySlug(slug: string) {
    const page = await this.db.query.pages.findFirst({
      where: eq(schema.pages.slug, slug),
    });
    if (!page) throw new NotFoundException(`No page at "${slug}"`);
    return page;
  }

  /** Public read. Unpublished pages are invisible, not merely unlinked. */
  async findPublished(slug: string) {
    const page = await this.db.query.pages.findFirst({
      where: eq(schema.pages.slug, slug),
    });

    if (!page?.publishedAt) {
      throw new NotFoundException(`No published page at "${slug}"`);
    }

    return {
      slug: page.slug,
      title: page.title,
      body: page.bodyMdx,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      updatedAt: page.updatedAt,
    };
  }

  async listPublishedSlugs() {
    const rows = await this.db.query.pages.findMany({
      where: isNotNull(schema.pages.publishedAt),
      columns: { slug: true, updatedAt: true },
    });
    return rows;
  }

  /**
   * Creates or updates by slug.
   *
   * One entry point rather than separate create and update, because the slug is
   * the identity here — there is exactly one About page — and an admin editing
   * it should not have to know whether a row already exists.
   */
  async upsert(input: UpsertPageInput, actor: AdminPrincipal) {
    const existing = await this.db.query.pages.findFirst({
      where: eq(schema.pages.slug, input.slug),
    });

    /*
     * `publishedAt` is preserved when it is already set and still published,
     * so re-saving a live page does not keep moving its publication date —
     * that timestamp is a record of when it went live, not when it was last
     * touched. `updatedAt` is what tracks edits, and the column maintains
     * itself.
     */
    const publishedAt = input.published ? (existing?.publishedAt ?? new Date()) : null;

    const values = {
      slug: input.slug,
      title: input.title,
      bodyMdx: input.body,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      publishedAt,
    };

    if (existing) {
      await this.db.update(schema.pages).set(values).where(eq(schema.pages.id, existing.id));

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (Boolean(existing.publishedAt) !== input.published) {
        changes.published = { from: Boolean(existing.publishedAt), to: input.published };
      }
      if (existing.bodyMdx !== input.body) {
        // The body itself is not recorded — it can be 100KB. That it changed,
        // and when, is what an audit trail needs.
        changes.body = { from: `${existing.bodyMdx.length} chars`, to: `${input.body.length} chars` };
      }

      await this.audit.record(actor, 'page.update', 'page', input.slug, changes);
      return this.findBySlug(input.slug);
    }

    await this.db.insert(schema.pages).values(values);
    await this.audit.record(actor, 'page.create', 'page', input.slug, {
      title: { from: null, to: input.title },
    });

    return this.findBySlug(input.slug);
  }
}
