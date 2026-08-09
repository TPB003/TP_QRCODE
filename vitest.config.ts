import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@client": path.resolve(projectRoot, "src/client"),
      "@worker": path.resolve(projectRoot, "src/worker"),
      "@shared": path.resolve(projectRoot, "src/shared"),
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
