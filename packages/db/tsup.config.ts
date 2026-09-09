import { defineConfig } from 'tsup';

export default defineConfig({
  // migrate.ts is compiled too, so the deploy-time migration step runs on
  // plain node and does not depend on tsx surviving a production install.
  entry: ['src/index.ts', 'src/schema/index.ts', 'src/migrate.ts', 'src/create-admin.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // @node-rs/argon2 loads a platform-specific .node binary through a dynamic
  // require. Bundling it makes esbuild try to resolve every platform's binary
  // at build time and fail on all of them; it must stay a runtime import.
  external: ['zod', 'drizzle-orm', 'mysql2', '@node-rs/argon2'],
});
