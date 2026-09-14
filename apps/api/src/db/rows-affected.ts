/**
 * How many rows a write actually changed.
 *
 * drizzle's mysql2 driver resolves an update or delete to the raw driver
 * result, which is a TUPLE: `[ResultSetHeader, FieldPacket[]]`. The row count
 * lives on element 0, not on the tuple. Reading `result.affectedRows` directly
 * yields `undefined`.
 *
 * That is not a hypothetical. It shipped: three call sites read the property
 * off the tuple and coalesced the `undefined` to `0` with `?? 0`. The worst of
 * them was the payment claim, where "zero rows changed" means "another delivery
 * already settled this order" — so every settlement short-circuited as a
 * duplicate. Orders that were genuinely paid stayed pending, no receipt was
 * sent, and nothing was logged, because from the code's point of view nothing
 * had gone wrong.
 *
 * Two decisions follow from that:
 *
 * 1. Read element 0 when the result is a tuple, and accept a bare header too,
 *    so a different driver or a test double does not silently take the wrong
 *    branch.
 * 2. THROW when the count cannot be read, rather than defaulting to 0. A
 *    fallback here is not a safe default — it is a specific, load-bearing claim
 *    ("nothing changed") invented from missing data, and inventing it is what
 *    made the original bug invisible. Failing loudly inside a transaction rolls
 *    it back and surfaces the problem.
 */
export function rowsAffected(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  const value = (header as { affectedRows?: unknown } | null | undefined)?.affectedRows;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      'Could not read affectedRows from the database result. The driver shape ' +
        'has changed; row counts cannot be trusted until this is corrected.',
    );
  }

  return value;
}
