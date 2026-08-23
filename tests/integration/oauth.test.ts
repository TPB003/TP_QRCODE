import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function readJson(response: Response): Promise<unknown> {
  return JSON.parse(await response.text());
}

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

  it("returns the most recently linked provider display name from the session", async () => {
    const email = "oauth-display-name@tpqr.test";
    const request = await SELF.fetch("http://local/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(request.status).toBe(200);
    const requestBody = await readJson(request) as { data?: { testCode?: string } };
    const verify = await SELF.fetch("http://local/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: requestBody.data?.testCode ?? "123456" }),
    });
    expect(verify.status).toBe(200);
    const cookie = verify.headers.get("set-cookie");
    const user = await readJson(verify) as { data: { id: string } };
    const database = (env as unknown as { DB: D1Database }).DB;
    const timestamp = new Date().toISOString();
    await database.prepare("INSERT INTO auth_identities (id, user_id, provider, provider_subject, email, display_name, created_at, last_login_at) VALUES (?, ?, 'github', ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), user.data.id, "github-subject-display", email, "octocat", timestamp, timestamp)
      .run();

    const me = await SELF.fetch("http://local/api/auth/me", { headers: { Cookie: cookie ?? "" } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ data: { email, displayName: "octocat", loginProvider: "github" } });
  });
});
