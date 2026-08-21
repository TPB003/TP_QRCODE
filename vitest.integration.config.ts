import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflarePool, cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [cloudflareTest(async () => ({
    main: "apps/worker/src/index.ts",
    wrangler: { configPath: "./apps/worker/wrangler.jsonc" },
    miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations(path.resolve(projectRoot, "infra/cloudflare/migrations")) } },
  }))],
  resolve: {
    alias: {
      "@client": path.resolve(projectRoot, "apps/web/src"),
      "@worker": path.resolve(projectRoot, "apps/worker/src"),
      "@shared": path.resolve(projectRoot, "packages/domain/src"),
      "@tpqr/domain": path.resolve(projectRoot, "packages/domain/src"),
      "@tpqr/content": path.resolve(projectRoot, "packages/content/src"),
      "@tpqr/qr": path.resolve(projectRoot, "packages/qr/src"),
      "@tpqr/ui": path.resolve(projectRoot, "packages/ui/src"),
    },
  },
  test: {
    pool: cloudflarePool({
      main: "apps/worker/src/index.ts",
      wrangler: { configPath: "./apps/worker/wrangler.jsonc" },
    }),
    exclude: ["**/node_modules/**", "**/dist/**", "**/.wrangler/**", "**/tmp/**", "**/output/**", "**/archive/**"],
    // Cloudflare's local D1/R2 runtime can cold-start a media request on
    // Windows. Keep the assertion strict while allowing that first request
    // to finish on a clean machine.
    testTimeout: 15_000,
    include: ["tests/integration/**/*.test.ts"],
    reporters: ["default"],
    setupFiles: ["tests/integration/setup.ts"],
  },
});
