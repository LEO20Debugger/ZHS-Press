import { describe, expect, it } from 'vitest';
import { shippingZoneSchema } from '@zhs/shared';
import { assertValidZone } from './shipping.service';

const ZONES = [
  { id: 1, zoneName: 'United States', countryCodes: ['US'], isDefault: false },
  { id: 2, zoneName: 'United Kingdom & Ireland', countryCodes: ['GB', 'IE'], isDefault: false },
  { id: 3, zoneName: 'Rest of world', countryCodes: [], isDefault: true },
];

describe('assertValidZone', () => {
  it('accepts a new zone with countries nobody else lists', () => {
    expect(() => assertValidZone({ isDefault: false, countryCodes: ['NG', 'GH'] }, ZONES, null)).not.toThrow();
  });

  it('refuses a country already in another zone, naming that zone', () => {
    // Listed twice, the rate charged would depend on row order.
    expect(() => assertValidZone({ isDefault: false, countryCodes: ['NG', 'GB'] }, ZONES, null)).toThrow(
      /GB is already in "United Kingdom & Ireland"/,
    );
  });

  it("lets a zone keep its own countries when it is edited", () => {
    expect(() => assertValidZone({ isDefault: false, countryCodes: ['GB', 'IE'] }, ZONES, 2)).not.toThrow();
  });

  it('refuses a non-default zone with no countries', () => {
    expect(() => assertValidZone({ isDefault: false, countryCodes: [] }, ZONES, 1)).toThrow(/at least one country/);
  });

  it('lets the default zone have no countries', () => {
    expect(() => assertValidZone({ isDefault: true, countryCodes: [] }, ZONES, 3)).not.toThrow();
  });
});

describe('shippingZoneSchema', () => {
  it('normalises country codes to upper case', () => {
    const parsed = shippingZoneSchema.parse({
      zoneName: 'West Africa',
      countryCodes: [' ng', 'gh'],
      rateCents: 500,
      freeOverCents: null,
    });
    expect(parsed.countryCodes).toEqual(['NG', 'GH']);
  });

  it('rejects anything that is not a two-letter code', () => {
    expect(
      shippingZoneSchema.safeParse({
        zoneName: 'X',
        countryCodes: ['Nigeria'],
        rateCents: 500,
        freeOverCents: null,
      }).success,
    ).toBe(false);
  });

  it('rejects fractional cents', () => {
    expect(
      shippingZoneSchema.safeParse({ zoneName: 'X', countryCodes: ['NG'], rateCents: 4.5, freeOverCents: null })
        .success,
    ).toBe(false);
  });
});
