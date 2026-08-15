import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: projectRoot,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@client": path.resolve(projectRoot, "src"),
      "@worker": path.resolve(projectRoot, "../worker/src"),
      "@shared": path.resolve(projectRoot, "../../packages/domain/src"),
      "@tpqr/domain": path.resolve(projectRoot, "../../packages/domain/src"),
      "@tpqr/content": path.resolve(projectRoot, "../../packages/content/src"),
      "@tpqr/qr": path.resolve(projectRoot, "../../packages/qr/src"),
      "@tpqr/ui": path.resolve(projectRoot, "../../packages/ui/src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: path.resolve(projectRoot, "../../dist"),
    emptyOutDir: true,
    sourcemap: true,
  },
});
