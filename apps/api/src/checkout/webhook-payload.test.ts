import { describe, expect, it } from 'vitest';
import { extractTransactionId } from './webhook.controller';

/**
 * Payload-shape tests for the Flutterwave webhook.
 *
 * Written after a live failure: an account with "Enable v3 webhooks" turned off
 * sent a payload with the transaction id at the top level, the handler read
 * only `data.id`, found nothing, and returned 200. Flutterwave's delivery log
 * showed a clean success while the paid order sat unsettled and no receipt went
 * out. The lesson these lock in is that the id's LOCATION is not something to
 * assume.
 */
describe('extractTransactionId', () => {
  it('reads the v3 shape, with the transaction nested under data', () => {
    expect(
      extractTransactionId({
        event: 'charge.completed',
        data: { id: 8832011, tx_ref: 'ZHS-ABC-123', status: 'successful' },
      }),
    ).toBe('8832011');
  });

  it('reads the legacy shape, with the id at the top level', () => {
    // The shape that broke production.
    expect(extractTransactionId({ event: 'charge.completed', id: 8832011 })).toBe('8832011');
  });

  it('reads transaction_id where that is the field used', () => {
    expect(extractTransactionId({ transaction_id: '8832011' })).toBe('8832011');
    expect(extractTransactionId({ data: { transaction_id: 8832011 } })).toBe('8832011');
  });

  it('prefers the nested id when a payload carries both', () => {
    expect(extractTransactionId({ id: 111, data: { id: 999 } })).toBe('999');
  });

  it('accepts an id sent as a string', () => {
    expect(extractTransactionId({ data: { id: '8832011' } })).toBe('8832011');
  });

  it('rejects a non-numeric id rather than sending it to the verify endpoint', () => {
    // An event id or reference, not a transaction id. Passing it on would
    // produce a confusing verification failure instead of a clear log line.
    expect(extractTransactionId({ data: { id: 'evt_abc123' } })).toBeNull();
    expect(extractTransactionId({ id: 'ZHS-ABC-123' })).toBeNull();
  });

  it('returns null for a payload carrying no id at all', () => {
    expect(extractTransactionId({ event: 'charge.completed' })).toBeNull();
    expect(extractTransactionId({})).toBeNull();
  });

  it('ignores an id that is present but empty', () => {
    expect(extractTransactionId({ data: { id: '' } })).toBeNull();
    expect(extractTransactionId({ id: '   ' })).toBeNull();
  });
});
