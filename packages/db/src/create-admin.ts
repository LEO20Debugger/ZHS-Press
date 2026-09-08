import { randomBytes } from 'node:crypto';
import { hash as argonHash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { closeDb, createDb } from './client';
import * as schema from './schema/index';

/**
 * Creates an admin account, or resets an existing one's password.
 *
 * Passwords are argon2id-hashed on write and never stored in plain text, so a
 * lost password cannot be recovered — only replaced. That is the correct
 * trade-off, but it means an operator needs a way to set a new one. The seed
 * script deliberately will not do this: it skips existing rows, so it can be
 * re-run safely without silently changing someone's credentials.
 *
 *   pnpm db:admin                              # reset the default admin
 *   pnpm db:admin faith@zhspress.org           # a specific account
 *   pnpm db:admin faith@zhspress.org editor    # create as an editor
 *
 * Set ADMIN_PASSWORD to choose the password; otherwise one is generated and
 * printed once.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  const email = (process.argv[2] ?? process.env.SEED_ADMIN_EMAIL ?? 'admin@zhspress.org')
    .trim()
    .toLowerCase();
  const role = (process.argv[3] ?? 'admin') as 'admin' | 'editor';

  if (role !== 'admin' && role !== 'editor') {
    throw new Error(`Role must be "admin" or "editor", received "${role}".`);
  }

  // 24 random bytes, base64url: no ambiguous characters, nothing to escape
  // when pasted into a terminal or a password manager.
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(24).toString('base64url');
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  }

  const db = createDb({ url });
  const passwordHash = await argonHash(password);

  const existing = await db.query.adminUsers.findFirst({
    where: eq(schema.adminUsers.email, email),
  });

  if (existing) {
    await db
      .update(schema.adminUsers)
      .set({ passwordHash, disabledAt: null })
      .where(eq(schema.adminUsers.id, existing.id));

    // Any session issued against the old password is revoked. A password reset
    // that leaves existing sessions alive is not really a reset.
    await db
      .update(schema.adminSessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.adminSessions.userId, existing.id));

    console.log(`\n  Password reset for ${email} (${existing.role}).`);
    console.log('  All existing sessions for this account have been revoked.');
  } else {
    await db.insert(schema.adminUsers).values({
      email,
      name: role === 'admin' ? 'ZHS Press Admin' : 'ZHS Press Editor',
      passwordHash,
      role,
    });
    console.log(`\n  Admin account created: ${email} (${role}).`);
  }

  console.log(`\n  password: ${password}`);
  console.log('\n  Save it now — it is hashed on write and cannot be shown again.\n');

  await closeDb();
}

main().catch(async (error: unknown) => {
  console.error('Failed:', error);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
