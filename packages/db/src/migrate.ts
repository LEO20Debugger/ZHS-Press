import { fileURLToPath } from 'node:url';
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

  // Resolved and logged before connecting, so a failed deploy still shows which
  // folder was used. fileURLToPath, not .pathname: on Windows the latter yields
  // "/C:/..." with a leading slash, which is not a usable path — it would work
  // on the Linux deploy host and fail on every developer machine.
  const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));
  console.log(`Migrations folder: ${migrationsFolder}`);

  // multipleStatements is required for the migrator; the app pool never enables it.
  const connection = await mysql.createConnection({ uri: url, multipleStatements: true });
  const db = drizzle(connection);

  console.log('Applying migrations...');
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied.');

  await connection.end();
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
