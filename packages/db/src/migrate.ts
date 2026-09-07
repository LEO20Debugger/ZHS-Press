import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';

/**
 * Applies generated SQL migrations.
 *
 * Deliberately a separate entrypoint from the app: migrations run as their own
 * deploy step, never on application boot, and never via `drizzle-kit push`
 * against a real environment.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set.');
  }

  // multipleStatements is required for the migrator; the app pool never enables it.
  const connection = await mysql.createConnection({ uri: url, multipleStatements: true });
  const db = drizzle(connection);

  console.log('Applying migrations...');
  await migrate(db, { migrationsFolder: new URL('../migrations', import.meta.url).pathname });
  console.log('Migrations applied.');

  await connection.end();
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
