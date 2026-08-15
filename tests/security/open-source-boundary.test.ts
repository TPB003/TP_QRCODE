import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("open-source boundary", () => {
  it("passes the repository scanner", () => {
    const output = execFileSync(process.execPath, ["scripts/check-open-source.mjs"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    expect(output).toContain("Open-source boundary check passed");
  });

  it("does not expose a concrete Worker host in deployment templates", () => {
    const template = path.join(repositoryRoot, "infra/cloudflare/wrangler.production.example.jsonc");
    const content = readFileSync(template, "utf8");
    expect(content).not.toMatch(/https?:\/\/(?!replace-with|your[-_]|example)[a-z0-9-]+\.workers\.dev/i);
  });
});
