import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /*
     * The email preview generator writes HTML to disk and asserts nothing, so
     * it has no business in a normal run or in CI. It is run on demand through
     * its own config — see vitest.preview.config.ts and `pnpm mail:preview`.
     */
    exclude: ['**/node_modules/**', 'src/mail/preview.test.ts'],
  },
});
