import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import type { ShippingZoneInput } from '@zhs/shared';
import type { AdminPrincipal } from '../auth/auth.service';
import { DB } from '../db/db.module';
import { AuditService } from './audit.service';

type ZoneRow = typeof schema.shippingRates.$inferSelect;

/**
 * Shipping zones, as edited from the admin Settings page.
 *
 * Checkout picks the first zone whose list holds the customer's country, and
 * falls back to the default zone otherwise (CheckoutService.resolveShippingRate).
 * Two rules keep that unambiguous, and both span rows, so they live here:
 *
 *  - Exactly one zone is the default, and it is the one with no countries. It
 *    cannot be deleted: without it, an order from an unlisted country would
 *    ship for nothing.
 *  - A country belongs to one zone at most. Listed twice, which rate applied
 *    would depend on row order, which nobody editing the page can see.
 */
@Injectable()
export class ShippingService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /** Default zone last, so the page reads specific-to-general. */
  async list(): Promise<ZoneRow[]> {
    const rows = await this.db.query.shippingRates.findMany({
      orderBy: [asc(schema.shippingRates.id)],
    });
    return [...rows.filter((row) => !row.isDefault), ...rows.filter((row) => row.isDefault)];
  }

  async create(input: ShippingZoneInput, actor: AdminPrincipal): Promise<ZoneRow[]> {
    const zones = await this.list();
    const countryCodes = unique(input.countryCodes);
    assertValidZone({ isDefault: false, countryCodes }, zones, null);

    await this.db.insert(schema.shippingRates).values({
      zoneName: input.zoneName,
      countryCodes,
      rateCents: input.rateCents,
      freeOverCents: input.freeOverCents,
      isDefault: false,
    });

    await this.audit.record(actor, 'shipping.create', 'shipping_zone', input.zoneName, {
      rateCents: { from: null, to: input.rateCents },
      countryCodes: { from: null, to: countryCodes },
    });

    return this.list();
  }

  async update(id: number, input: ShippingZoneInput, actor: AdminPrincipal): Promise<ZoneRow[]> {
    const zones = await this.list();
    const existing = zones.find((zone) => zone.id === id);
    if (!existing) throw new NotFoundException('Shipping zone not found');

    const countryCodes = existing.isDefault ? [] : unique(input.countryCodes);
    assertValidZone({ isDefault: existing.isDefault, countryCodes }, zones, id);

    await this.db
      .update(schema.shippingRates)
      .set({
        zoneName: input.zoneName,
        countryCodes,
        rateCents: input.rateCents,
        freeOverCents: input.freeOverCents,
      })
      .where(eq(schema.shippingRates.id, id));

    await this.audit.record(actor, 'shipping.update', 'shipping_zone', String(id), diff(existing, {
      zoneName: input.zoneName,
      countryCodes,
      rateCents: input.rateCents,
      freeOverCents: input.freeOverCents,
    }));

    return this.list();
  }

  async remove(id: number, actor: AdminPrincipal): Promise<ZoneRow[]> {
    const existing = await this.db.query.shippingRates.findFirst({
      where: eq(schema.shippingRates.id, id),
    });
    if (!existing) throw new NotFoundException('Shipping zone not found');
    if (existing.isDefault) {
      throw new BadRequestException(
        'The rest-of-world zone cannot be removed — it prices every country not listed elsewhere.',
      );
    }

    await this.db.delete(schema.shippingRates).where(eq(schema.shippingRates.id, id));
    await this.audit.record(actor, 'shipping.delete', 'shipping_zone', String(id), {
      zoneName: { from: existing.zoneName, to: null },
    });

    return this.list();
  }
}

function unique(codes: string[]): string[] {
  return [...new Set(codes)];
}

/** Exported for tests: the cross-row rules, independent of the database. */
export function assertValidZone(
  zone: { isDefault: boolean; countryCodes: string[] },
  zones: Array<Pick<ZoneRow, 'id' | 'zoneName' | 'countryCodes' | 'isDefault'>>,
  ownId: number | null,
): void {
  if (!zone.isDefault && zone.countryCodes.length === 0) {
    throw new BadRequestException(
      'List at least one country. Countries not listed anywhere use the rest-of-world rate.',
    );
  }

  for (const other of zones) {
    if (other.id === ownId) continue;
    const clash = zone.countryCodes.find((code) => other.countryCodes.includes(code));
    if (clash) {
      throw new BadRequestException(`${clash} is already in "${other.zoneName}". A country can be in one zone only.`);
    }
  }
}

function diff(
  before: ZoneRow,
  after: Pick<ZoneRow, 'zoneName' | 'countryCodes' | 'rateCents' | 'freeOverCents'>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after) as Array<keyof typeof after>) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }
  return changes;
}
