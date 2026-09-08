import { defineConfig } from 'tsup';

export default defineConfig({
  // migrate.ts is compiled too, so the deploy-time migration step runs on
  // plain node and does not depend on tsx surviving a production install.
  entry: ['src/index.ts', 'src/schema/index.ts', 'src/migrate.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['zod', 'drizzle-orm', 'mysql2'],
});
