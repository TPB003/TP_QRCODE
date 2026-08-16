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

  it("uses Resend in production and never ships a fixed verification code", () => {
    const template = path.join(repositoryRoot, "infra/cloudflare/wrangler.production.example.jsonc");
    const content = readFileSync(template, "utf8");
    expect(content).toMatch(/"ENVIRONMENT"\s*:\s*"production"/);
    expect(content).toMatch(/"AUTH_DELIVERY_MODE"\s*:\s*"resend"/);
    expect(content).not.toMatch(/AUTH_TEST_CODE/);
    expect(content).not.toMatch(/123456/);
  });

  it("documents secret-only Resend configuration", () => {
    const guide = readFileSync(path.join(repositoryRoot, "docs/deployment-cloudflare.md"), "utf8");
    expect(guide).toMatch(/AUTH_DELIVERY_MODE\s*=\s*resend/i);
    expect(guide).toMatch(/RESEND_API_KEY/);
    expect(guide).toMatch(/wrangler\s+secret\s+put\s+RESEND_API_KEY/i);
    expect(guide).toMatch(/RESEND_FROM_EMAIL/);
    expect(guide).toMatch(/must not set `AUTH_TEST_CODE`|not set `AUTH_TEST_CODE`/i);
  });
});
