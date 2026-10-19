import { describe, expect, it } from 'vitest';
import { addProductImageSchema, amazonUrlSchema } from './schemas';

const ok = (value: string) => amazonUrlSchema.safeParse(value).success;

describe('amazonUrlSchema', () => {
  it('accepts Amazon storefronts in any market', () => {
    expect(ok('https://www.amazon.com/dp/B0EXAMPLE')).toBe(true);
    expect(ok('https://www.amazon.co.uk/dp/B0EXAMPLE')).toBe(true);
    expect(ok('https://amazon.de/dp/B0EXAMPLE')).toBe(true);
    expect(ok('https://www.amazon.com.ng/dp/B0EXAMPLE')).toBe(true);
  });

  it("accepts Amazon's own short links", () => {
    expect(ok('https://amzn.to/3abcDEF')).toBe(true);
    expect(ok('https://a.co/d/abc123')).toBe(true);
  });

  it('refuses any other site', () => {
    expect(ok('https://example.com/book')).toBe(false);
    expect(ok('https://zhspress.org/books/soar')).toBe(false);
  });

  it('refuses look-alikes that only contain the word amazon', () => {
    // The checks that matter: these would pass a naive "includes amazon" test.
    expect(ok('https://amazon.com.evil.io/dp/B0EXAMPLE')).toBe(false);
    expect(ok('https://notamazon.com/dp/B0EXAMPLE')).toBe(false);
    expect(ok('https://evil.io/?u=https://www.amazon.com')).toBe(false);
  });

  it('refuses plain http', () => {
    expect(ok('http://www.amazon.com/dp/B0EXAMPLE')).toBe(false);
  });
});

describe('addProductImageSchema', () => {
  const image = (url: string) => addProductImageSchema.safeParse({ url, alt: 'A cover' }).success;

  it('accepts a path on this site', () => {
    expect(image('/covers/soar.jpg')).toBe(true);
  });

  it('refuses outside addresses, including protocol-relative ones', () => {
    expect(image('https://example.com/cover.jpg')).toBe(false);
    expect(image('//example.com/cover.jpg')).toBe(false);
  });
});
