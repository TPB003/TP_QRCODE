import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
