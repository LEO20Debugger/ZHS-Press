import { describe, expect, it } from 'vitest';
import { rowsAffected } from './rows-affected';

/**
 * These exist because the absence of them cost a day.
 *
 * Reading `affectedRows` off drizzle/mysql2's result tuple yields `undefined`,
 * and the old code coalesced that to 0 with `?? 0`. In `settlePayment` a count
 * of 0 means "already settled by another delivery", so every payment
 * short-circuited as a duplicate: paid orders stayed pending, no receipt went
 * out, and nothing was logged. The suite stayed green throughout, because the
 * stubs returned a bare object rather than the tuple the driver actually
 * returns.
 */
describe('rowsAffected', () => {
  it('reads the count from the driver tuple', () => {
    // [ResultSetHeader, FieldPacket[]] — what drizzle/mysql2 actually resolves.
    expect(rowsAffected([{ affectedRows: 1 }, []])).toBe(1);
    expect(rowsAffected([{ affectedRows: 0 }, []])).toBe(0);
    expect(rowsAffected([{ affectedRows: 42 }, []])).toBe(42);
  });

  it('accepts a bare header, so a different driver does not silently misread', () => {
    expect(rowsAffected({ affectedRows: 3 })).toBe(3);
  });

  it('throws rather than inventing 0 when the count is missing', () => {
    // The whole point. `?? 0` here is not a safe default — it is a specific,
    // load-bearing claim ("nothing changed") conjured from missing data.
    expect(() => rowsAffected({})).toThrow(/affectedRows/i);
    expect(() => rowsAffected([{}, []])).toThrow(/affectedRows/i);
    expect(() => rowsAffected(undefined)).toThrow(/affectedRows/i);
    expect(() => rowsAffected(null)).toThrow(/affectedRows/i);
  });

  it('throws on a non-numeric count', () => {
    expect(() => rowsAffected({ affectedRows: '1' })).toThrow(/affectedRows/i);
    expect(() => rowsAffected({ affectedRows: NaN })).toThrow(/affectedRows/i);
  });
});
