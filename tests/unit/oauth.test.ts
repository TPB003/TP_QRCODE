import { describe, expect, it } from "vitest";
import { createAuthorizationUrl, enabledProviders, githubTokenExchangeParams, safeReturnTo } from "@worker/lib/oauth";

describe("oauth safety helpers", () => {
  it("only accepts internal return paths", () => {
    expect(safeReturnTo("/app?view=codes")).toBe("/app?view=codes");
    expect(safeReturnTo("/decoder")).toBe("/decoder");
    expect(safeReturnTo("https://evil.example/steal")).toBe("/app");
    expect(safeReturnTo("//evil.example")).toBe("/app");
    expect(safeReturnTo("/login")).toBe("/app");
  });

  it("does not expose disabled providers without both credentials", () => {
    const env = {} as Parameters<typeof enabledProviders>[0];
    expect(enabledProviders(env)).toEqual({ google: false, github: false });
    expect(enabledProviders({ AUTH_GOOGLE_CLIENT_ID: "id" } as Parameters<typeof enabledProviders>[0])).toEqual({ google: false, github: false });
  });

  it("uses PKCE for GitHub authorization", async () => {
    const env = {
      APP_ORIGIN: "http://127.0.0.1:8787",
      AUTH_OAUTH_CALLBACK_ORIGIN: "http://127.0.0.1:8787",
      AUTH_GITHUB_CLIENT_ID: "github-client",
      AUTH_GITHUB_CLIENT_SECRET: "github-secret",
      DB: {
        prepare: () => ({
          bind: () => ({ run: () => Promise.resolve({ success: true, meta: { changes: 1 } }) }),
        }),
      },
    } as never;
    const url = new URL(await createAuthorizationUrl(env, "github", "/app"));
    expect(url.origin).toBe("https://github.com");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    const tokenParams = githubTokenExchangeParams("github-client", "github-secret", "auth-code", "verifier", "http://127.0.0.1:8787/api/auth/github/callback");
    expect(tokenParams.get("code_verifier")).toBe("verifier");
    expect(tokenParams.get("redirect_uri")).toBe("http://127.0.0.1:8787/api/auth/github/callback");
  });
});
