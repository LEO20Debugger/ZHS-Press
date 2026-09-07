import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Consumers bring their own copies; bundling them would duplicate zod and
  // break drizzle's instanceof checks.
  external: ['zod', 'drizzle-orm', 'mysql2'],
});
