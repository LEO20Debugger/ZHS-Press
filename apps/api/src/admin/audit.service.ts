import { Inject, Injectable } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import { DB } from '../db/db.module';
import type { AdminPrincipal } from '../auth/auth.service';

/**
 * Append-only audit trail.
 *
 * Records who changed what, with before/after values for the fields that
 * matter. Deliberately never updated or deleted — a trail that can be edited
 * is not a trail.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(
    actor: AdminPrincipal,
    action: string,
    entityType: string,
    entityId: string,
    changes: Record<string, { from: unknown; to: unknown }> = {},
  ): Promise<void> {
    await this.db.insert(schema.auditLog).values({
      actorId: actor.id,
      action,
      entityType,
      entityId,
      changes: Object.keys(changes).length > 0 ? changes : null,
    });
  }

  async recent(limit = 50) {
    return this.db.query.auditLog.findMany({
      orderBy: [desc(schema.auditLog.createdAt)],
      limit,
    });
  }
}
