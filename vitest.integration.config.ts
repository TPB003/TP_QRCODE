import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflarePool, cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [cloudflareTest(async () => ({
    main: "src/worker/index.ts",
    wrangler: { configPath: "./wrangler.jsonc" },
    miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations(path.resolve(projectRoot, "migrations")) } },
  }))],
  resolve: {
    alias: {
      "@client": path.resolve(projectRoot, "src/client"),
      "@worker": path.resolve(projectRoot, "src/worker"),
      "@shared": path.resolve(projectRoot, "src/shared"),
    },
  },
  test: {
    pool: cloudflarePool({
      main: "src/worker/index.ts",
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
    include: ["tests/integration/**/*.test.ts"],
    reporters: ["default"],
    setupFiles: ["tests/integration/setup.ts"],
  },
});
