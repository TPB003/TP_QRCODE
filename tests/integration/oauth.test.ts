import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("oauth endpoints", () => {
  it("reports provider availability without exposing configuration", async () => {
    const response = await SELF.fetch("http://local/api/auth/providers");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { google: false, github: false } });
  });

  it("fails closed when a provider is not configured", async () => {
    const response = await SELF.fetch("http://local/api/auth/google/start?returnTo=https%3A%2F%2Fevil.example", { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/login?oauth_error=AUTH_PROVIDER_DISABLED");
    expect(response.headers.get("location")).not.toContain("evil.example");
  });
});
