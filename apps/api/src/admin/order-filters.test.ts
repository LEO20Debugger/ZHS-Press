import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';
import { orderFilters } from './admin.controller';

const dialect = new MySqlDialect();
const compile = (input: Parameters<typeof orderFilters>[0]) => {
  const where = orderFilters(input);
  return where ? dialect.sqlToQuery(where) : null;
};

describe('orderFilters', () => {
  it('filters nothing when given nothing', () => {
    expect(compile({})).toBeNull();
    expect(compile({ search: '   ' })).toBeNull();
  });

  it('searches email and order number by substring', () => {
    const query = compile({ search: 'gmail' })!;
    expect(query.sql).toMatch(/`email` like \?/);
    expect(query.sql).toMatch(/`order_number` like \?/);
    expect(query.params).toEqual(['%gmail%', '%gmail%']);
  });

  it('matches LIKE wildcards in a search literally', () => {
    expect(compile({ search: '50%_off' })!.params).toEqual(['%50\\%\\_off%', '%50\\%\\_off%']);
  });

  it('bounds by the instants given', () => {
    const query = compile({ from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' })!;
    expect(query.sql).toMatch(/`created_at` >= \?/);
    expect(query.sql).toMatch(/`created_at` <= \?/);
  });

  it('ignores a date it cannot read rather than failing', () => {
    expect(compile({ from: 'not-a-date' })).toBeNull();
  });

  it('combines every filter given', () => {
    const query = compile({ status: 'paid', search: 'zhs-', from: '2026-10-01T00:00:00Z' })!;
    expect(query.sql).toMatch(/`status` = \?/);
    expect(query.sql).toMatch(/like/);
    expect(query.sql).toMatch(/`created_at` >= \?/);
  });
});
