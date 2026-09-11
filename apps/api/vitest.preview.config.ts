import { defineConfig } from 'vitest/config';

/**
 * Renders the email templates to apps/api/email-previews/.
 *
 * A separate config rather than an environment variable, because setting one
 * inline in an npm script (`FOO=1 vitest`) is not portable to Windows, and this
 * repo is developed on it.
 */
export default defineConfig({
  test: { environment: 'node', include: ['src/mail/preview.test.ts'] },
});
