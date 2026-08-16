import { describe, expect, it } from "vitest";
import { enabledProviders, safeReturnTo } from "@worker/lib/oauth";

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
});
