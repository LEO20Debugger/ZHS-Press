import { Logger } from '@nestjs/common';

const logger = new Logger('Process');

function megabytes(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}

/**
 * Makes an unexplained death explain itself.
 *
 * A container that boots cleanly, serves, and then disappears is close to
 * undiagnosable from a deploy log, because the two likely causes leave almost
 * no trace and look nothing alike:
 *
 * - **The OOM killer** sends SIGKILL. The process is gone instantly, exit code
 *   137, and by definition it cannot log its own death. The only usable
 *   evidence is the memory trend *before* it happened, which is why usage is
 *   sampled periodically rather than only on exit.
 * - **An unhandled error or rejection** exits with code 1 and, under a process
 *   manager that restarts immediately, scrolls past unread.
 *
 * Nothing here changes behaviour. It exists so the next crash names itself
 * instead of prompting another round of guessing.
 */
export function installProcessDiagnostics(): void {
  /*
   * Logged, then rethrown by exiting.
   *
   * Swallowing an uncaught exception and carrying on is worse than crashing:
   * the process continues with whatever invariant just broke still broken.
   * The value added here is the log line, not the survival.
   */
  process.on('uncaughtException', (error) => {
    logger.error(
      `FATAL uncaughtException — ${error.message}\n` +
        `  rss=${megabytes(process.memoryUsage().rss)}MB\n` +
        (error.stack ?? ''),
    );
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(
      `FATAL unhandledRejection — ${error.message}\n` +
        `  rss=${megabytes(process.memoryUsage().rss)}MB\n` +
        (error.stack ?? ''),
    );
    process.exit(1);
  });

  // SIGTERM is the platform asking politely — a redeploy, a scale-down. Worth
  // distinguishing in the log from a crash, since they look identical from
  // outside and mean completely different things.
  process.on('SIGTERM', () => {
    logger.log(`SIGTERM received (rss=${megabytes(process.memoryUsage().rss)}MB) — shutting down.`);
  });

  /*
   * A memory sample every five minutes.
   *
   * Frequent enough to show a trend across the ~18 minute lifetime this was
   * written to diagnose, infrequent enough not to bury the log. `rss` is the
   * number that matters: the container limit applies to resident memory, and
   * native allocations — sharp's image buffers above all — never appear in the
   * V8 heap figures at all, so watching heapUsed alone can show a flat line
   * right up to the moment the process is killed.
   *
   * unref() so this timer never keeps the process alive on shutdown.
   */
  setInterval(
    () => {
      const { rss, heapUsed, heapTotal, external } = process.memoryUsage();
      logger.log(
        `memory rss=${megabytes(rss)}MB heap=${megabytes(heapUsed)}/${megabytes(heapTotal)}MB ` +
          `external=${megabytes(external)}MB uptime=${Math.round(process.uptime() / 60)}min`,
      );
    },
    5 * 60 * 1000,
  ).unref();
}
