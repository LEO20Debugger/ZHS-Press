import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema/index';

export type Database = MySql2Database<typeof schema>;

let pool: mysql.Pool | undefined;
let db: Database | undefined;

export interface DbConfig {
  url: string;
  /** Keep this modest; serverless platforms multiply it by every warm instance. */
  connectionLimit?: number;
}

/**
 * Creates the shared connection pool. Called once at process start.
 *
 * `decimalNumbers` and `bigNumberStrings` are deliberately left at their
 * defaults: no money passes through a MySQL DECIMAL in this schema, it is all
 * integer cents, so there is no float-parsing boundary to get wrong.
 */
export function createDb(config: DbConfig): Database {
  if (db) return db;

  if (!config.url) {
    throw new Error('DATABASE_URL is not set. Refusing to start without a database.');
  }

  pool = mysql.createPool({
    uri: config.url,
    connectionLimit: config.connectionLimit ?? 10,
    waitForConnections: true,
    queueLimit: 0,
    timezone: 'Z',
    charset: 'utf8mb4',
    supportBigNumbers: true,
  });

  /*
   * No pool-level 'error' listener here, deliberately — it would be dead code.
   *
   * The obvious worry is that a pooled connection dying while idle (server
   * wait_timeout, a proxy closing the socket) emits an unhandled 'error' and
   * takes the process down, since Node throws unhandled 'error' events. Two
   * things in mysql2 rule that out, both checked in its source rather than
   * assumed:
   *
   * 1. `PoolConnection`'s constructor attaches `once('error', …)` to every
   *    connection it creates, so the event is never unhandled.
   * 2. The promise wrapper only forwards 'acquire', 'connection', 'enqueue'
   *    and 'release' (lib/promise/inherit_events.js), so a listener attached
   *    to this pool would not receive 'error' anyway.
   */
  db = drizzle(pool, { schema, mode: 'default' });
  return db;
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialised. Call createDb() during bootstrap.');
  }
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

export { schema };
