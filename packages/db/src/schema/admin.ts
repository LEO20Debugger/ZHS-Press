import { relations } from 'drizzle-orm';
import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * Admin accounts. There are no shopper accounts — checkout is guest-only, so
 * this table is small and strictly privileged.
 *
 * `editor` covers content: products, pages, images, contributors.
 * `admin` additionally covers orders, refunds, shipping rates and user
 * management. The Publishing Associate is an editor.
 */
export const adminRole = ['admin', 'editor'] as const;

export const adminUsers = mysqlTable(
  'admin_users',
  {
    id: int('id').autoincrement().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    /** argon2id. Never bcrypt-with-a-low-cost, never a bare hash. */
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: mysqlEnum('role', adminRole).notNull().default('editor'),
    lastLoginAt: timestamp('last_login_at'),
    disabledAt: timestamp('disabled_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex('admin_users_email_idx').on(t.email)],
);

/**
 * Server-side refresh sessions. Storing a hash (not the token) means a database
 * read cannot be replayed as a valid session.
 */
export const adminSessions = mysqlTable(
  'admin_sessions',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    userAgent: varchar('user_agent', { length: 320 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('admin_sessions_token_hash_idx').on(t.tokenHash),
    index('admin_sessions_user_idx').on(t.userId),
  ],
);

/**
 * Append-only audit trail. Price edits and order status changes are exactly the
 * things you want a history of when a customer disputes a charge.
 */
export const auditLog = mysqlTable(
  'audit_log',
  {
    id: int('id').autoincrement().primaryKey(),
    actorId: int('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    /** e.g. 'product.update', 'order.refund', 'product.delete'. */
    action: varchar('action', { length: 80 }).notNull(),
    entityType: varchar('entity_type', { length: 60 }).notNull(),
    entityId: varchar('entity_id', { length: 64 }).notNull(),
    /** Changed fields only, as { field: { from, to } }. */
    changes: json('changes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_created_idx').on(t.createdAt),
  ],
);

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  user: one(adminUsers, { fields: [adminSessions.userId], references: [adminUsers.id] }),
}));
