import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AdminProductsService } from './admin-products.service';
import type { AdminPrincipal } from '../auth/auth.service';

/**
 * The question a bug here gets wrong is not "does the row go" — it is whether
 * a title that has actually sold can be destroyed by someone who cannot see
 * that it sold. So these drive the guard, with a stub standing in for the
 * order-line count, and assert on what reached the database as much as on what
 * came back.
 */
interface Recorded {
  deletedIds: number[];
  audits: Array<{ action: string; entityId: string }>;
}

const ACTOR = { id: 1, email: 'admin@zhspress.org', role: 'admin' } as unknown as AdminPrincipal;

function makeService(options: { product?: Record<string, unknown> | null; orderLines: number }): {
  service: AdminProductsService;
  log: Recorded;
} {
  const log: Recorded = { deletedIds: [], audits: [] };

  const db = {
    query: {
      products: {
        findFirst: async () =>
          options.product === undefined
            ? { id: 9, title: 'The Moss Journal', slug: 'journal-moss' }
            : options.product,
      },
    },
    select: () => ({
      from: () => ({
        where: async () => [{ lines: options.orderLines }],
      }),
    }),
    delete: () => ({
      where: async () => {
        log.deletedIds.push(9);
      },
    }),
  };

  const audit = {
    record: async (_actor: unknown, action: string, _entity: string, entityId: string) => {
      log.audits.push({ action, entityId });
    },
  };

  return {
    service: new AdminProductsService(db as never, audit as never, {} as never),
    log,
  };
}

describe('remove', () => {
  it('deletes a product that has never been ordered', async () => {
    const { service, log } = makeService({ orderLines: 0 });

    await expect(service.remove(9, ACTOR)).resolves.toEqual({ ok: true });
    expect(log.deletedIds).toEqual([9]);
    expect(log.audits).toEqual([{ action: 'product.delete', entityId: '9' }]);
  });

  it('refuses a product that has been ordered, and says to archive it', async () => {
    const { service, log } = makeService({ orderLines: 3 });

    await expect(service.remove(9, ACTOR)).rejects.toBeInstanceOf(ConflictException);
    // The important half: the guard threw *before* anything was destroyed.
    expect(log.deletedIds).toEqual([]);
    expect(log.audits).toEqual([]);
  });

  it('names the title and the way forward in the refusal', async () => {
    const { service } = makeService({ orderLines: 1 });

    await expect(service.remove(9, ACTOR)).rejects.toMatchObject({
      response: {
        message: expect.stringContaining('The Moss Journal'),
      },
    });
    await expect(service.remove(9, ACTOR)).rejects.toMatchObject({
      response: { message: expect.stringContaining('Archive it instead') },
    });
  });

  it('404s on a product that is not there rather than reporting a delete', async () => {
    const { service, log } = makeService({ product: null, orderLines: 0 });

    await expect(service.remove(9, ACTOR)).rejects.toBeInstanceOf(NotFoundException);
    expect(log.deletedIds).toEqual([]);
  });
});
