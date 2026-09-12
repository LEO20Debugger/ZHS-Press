import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, like, sql } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import type { AttachContributorInput, ContributorRole } from '@zhs/shared';
import { DB } from '../db/db.module';
import { AuditService } from './audit.service';
import type { AdminPrincipal } from '../auth/auth.service';

/**
 * Turns a display name into a URL slug.
 *
 * Exported for its tests: the interesting cases are names this project will
 * actually see — accented Latin, apostrophes, hyphens — and getting them wrong
 * produces a slug that either collides or contains characters that have to be
 * escaped in every link to it.
 */
export function slugifyName(name: string): string {
  return (
    name
      .normalize('NFKD')
      // Strip the combining marks NFKD just separated out, so "Chinụa" becomes
      // "chinua" rather than losing the letter entirely.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 150) || 'contributor'
  );
}

@Injectable()
export class ContributorsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /** Type-ahead for the admin's contributor picker. */
  async search(term?: string) {
    const where = term ? like(schema.contributors.name, `%${term}%`) : undefined;

    return this.db.query.contributors.findMany({
      where,
      orderBy: [asc(schema.contributors.name)],
      limit: 20,
    });
  }

  /**
   * Finds a free slug for a name.
   *
   * `contributors.slug` is unique, and two different people genuinely can share
   * a name. Rather than rejecting the second one — which would make the admin
   * unusable the first time it happened — the slug gets a numeric suffix.
   *
   * The loop is bounded: an unbounded "try the next number" against a unique
   * index is a livelock waiting for a bad day.
   */
  private async freeSlug(name: string): Promise<string> {
    const base = slugifyName(name);

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const taken = await this.db.query.contributors.findFirst({
        where: eq(schema.contributors.slug, candidate),
      });
      if (!taken) return candidate;
    }

    throw new BadRequestException(
      `Could not find a free URL slug for "${name}". Rename slightly, or attach the existing contributor instead.`,
    );
  }

  /**
   * Attaches a contributor to a product, creating the person if new.
   *
   * The join's primary key is (product, contributor, role), which is
   * deliberate: an illustrator who also wrote a piece appears twice under
   * different roles, but the same person cannot be added twice in the same
   * role. That collision is reported as a readable message rather than a
   * duplicate-key error.
   */
  async attach(productId: number, input: AttachContributorInput, actor: AdminPrincipal) {
    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, productId),
    });
    if (!product) throw new NotFoundException('Product not found');

    let contributorId = input.contributorId;

    if (!contributorId) {
      const name = input.name!.trim();
      const slug = await this.freeSlug(name);

      const [inserted] = await this.db.insert(schema.contributors).values({ name, slug });
      contributorId = Number((inserted as unknown as { insertId: number }).insertId);

      await this.audit.record(actor, 'contributor.create', 'contributor', String(contributorId), {
        name: { from: null, to: name },
      });
    } else {
      const exists = await this.db.query.contributors.findFirst({
        where: eq(schema.contributors.id, contributorId),
      });
      if (!exists) throw new NotFoundException('Contributor not found');
    }

    const already = await this.db.query.productContributors.findFirst({
      where: and(
        eq(schema.productContributors.productId, productId),
        eq(schema.productContributors.contributorId, contributorId),
        eq(schema.productContributors.role, input.role),
      ),
    });

    if (already) {
      throw new BadRequestException({
        message: `That person is already credited as ${input.role} on this title.`,
        errors: [{ field: 'role', message: 'Already credited in this role.' }],
      });
    }

    // Append. Reading the current maximum rather than counting rows, so a gap
    // left by a removal does not put two people at the same position.
    const [last] = await this.db
      .select({ value: sql<number>`COALESCE(MAX(${schema.productContributors.position}), -1)` })
      .from(schema.productContributors)
      .where(eq(schema.productContributors.productId, productId));

    await this.db.insert(schema.productContributors).values({
      productId,
      contributorId,
      role: input.role,
      pieceTitle: input.pieceTitle ?? null,
      position: Number(last?.value ?? -1) + 1,
    });

    await this.audit.record(actor, 'product.contributor.add', 'product', String(productId), {
      contributorId: { from: null, to: contributorId },
    });

    return this.listForProduct(productId);
  }

  async detach(
    productId: number,
    contributorId: number,
    role: ContributorRole,
    actor: AdminPrincipal,
  ) {
    await this.db
      .delete(schema.productContributors)
      .where(
        and(
          eq(schema.productContributors.productId, productId),
          eq(schema.productContributors.contributorId, contributorId),
          eq(schema.productContributors.role, role),
        ),
      );

    /*
     * The person is left in place, not deleted.
     *
     * They may be credited on other issues, and even if not, a contributor is
     * a record of someone the press has published — removing a credit from one
     * issue is not the same as saying they never existed. Tidying orphans is a
     * separate, deliberate act.
     */
    await this.audit.record(actor, 'product.contributor.remove', 'product', String(productId), {
      contributorId: { from: contributorId, to: null },
    });

    return this.listForProduct(productId);
  }

  /** Reorders credits. Anything not named keeps its place after those that are. */
  async reorder(productId: number, contributorIds: number[], actor: AdminPrincipal) {
    for (const [index, contributorId] of contributorIds.entries()) {
      await this.db
        .update(schema.productContributors)
        .set({ position: index })
        .where(
          and(
            eq(schema.productContributors.productId, productId),
            eq(schema.productContributors.contributorId, contributorId),
          ),
        );
    }

    await this.audit.record(actor, 'product.contributor.reorder', 'product', String(productId), {});
    return this.listForProduct(productId);
  }

  async listForProduct(productId: number) {
    const rows = await this.db.query.productContributors.findMany({
      where: eq(schema.productContributors.productId, productId),
      orderBy: [asc(schema.productContributors.position)],
      with: { contributor: true },
    });

    return rows.map((row) => ({
      contributorId: row.contributorId,
      name: row.contributor.name,
      slug: row.contributor.slug,
      role: row.role,
      pieceTitle: row.pieceTitle,
      position: row.position,
    }));
  }

  /** Every contributor, with how many titles each appears on. */
  async list() {
    return this.db
      .select({
        id: schema.contributors.id,
        name: schema.contributors.name,
        slug: schema.contributors.slug,
        credits: sql<number>`COUNT(${schema.productContributors.productId})`,
      })
      .from(schema.contributors)
      .leftJoin(
        schema.productContributors,
        eq(schema.contributors.id, schema.productContributors.contributorId),
      )
      .groupBy(schema.contributors.id, schema.contributors.name, schema.contributors.slug)
      .orderBy(desc(sql`COUNT(${schema.productContributors.productId})`), asc(schema.contributors.name));
  }
}
