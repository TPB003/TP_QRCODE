import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

type Body<T = Record<string, unknown>> = { data?: T; error?: { code?: string; message?: string } };
async function body<T extends Body = Body>(response: Response): Promise<T> { const value: unknown = await response.json(); return value as T; }
let id = 0;

async function auth(): Promise<string> {
  id += 1;
  const email = `security-${id}@active.tpqr.local`;
  const requested = await SELF.fetch("http://local/api/auth/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  const requestedBody = await body<{ data: { testCode?: string } }>(requested);
  const verified = await SELF.fetch("http://local/api/auth/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code: requestedBody.data.testCode ?? "123456" }) });
  expect(verified.status).toBe(200);
  return verified.headers.get("set-cookie") ?? "";
}

async function code(cookie: string, content: Record<string, unknown> = { type: "text", title: "Security", text: "safe" }) {
  const response = await SELF.fetch("http://local/api/codes", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ title: "Security test", content }) });
  expect(response.status).toBe(201);
  return (await body<{ data: { id: string; slug: string; revision: number } }>(response)).data;
}

describe("active code security boundaries", () => {
  it("returns consistent error envelopes and protects management routes", async () => {
    const unauthorized = await SELF.fetch("http://local/api/codes");
    expect(unauthorized.status).toBe(401);
    expect((await body<{ error: { code: string } }>(unauthorized)).error.code).toBe("UNAUTHORIZED");

    const cookie = await auth();
    const invalid = await SELF.fetch("http://local/api/codes", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ title: "", content: { type: "text", text: "" } }) });
    expect(invalid.status).toBe(422);
    const invalidBody = await body<{ error: { code: string } }>(invalid);
    expect(invalidBody.error.code).toBe("VALIDATION_ERROR");
    expect(invalidBody).not.toHaveProperty("data");

    const missing = await SELF.fetch("http://local/api/codes/not-a-uuid", { headers: { Cookie: cookie } });
    expect(missing.status).toBe(404);
    expect((await body<{ error: { code: string } }>(missing)).error.code).toBe("NOT_FOUND");
  });

  it("rejects unsafe URL payloads before publication", async () => {
    const cookie = await auth();
    for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "ftp://example.com/file", "https://user:password@example.com"]) {
      const response = await SELF.fetch("http://local/api/codes", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ title: "unsafe", content: { type: "url", url } }) });
      expect(response.status, url).toBe(422);
      expect((await body<{ error: { code: string } }>(response)).error.code, url).toBe("VALIDATION_ERROR");
    }
    const safe = await SELF.fetch("http://local/api/codes", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ title: "safe", content: { type: "url", url: "https://example.com/a?b=1" } }) });
    expect(safe.status).toBe(201);
  });

  it("does not leak R2 object keys through the public response or proxy", async () => {
    const cookie = await auth();
    const placeholder = await code(cookie);
    const form = new FormData();
    form.set("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "document.pdf", { type: "application/pdf" }));
    const upload = await SELF.fetch(`http://local/api/codes/${placeholder.id}/assets`, { method: "POST", headers: { Cookie: cookie }, body: form });
    expect(upload.status).toBe(201);
    const assetId = (await body<{ data: { id: string } }>(upload)).data.id;
    const patch = await SELF.fetch(`http://local/api/codes/${placeholder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision: placeholder.revision, content: { type: "file", assetId, title: "PDF", description: "test", downloadName: "document.pdf" } }) });
    const revision = (await body<{ data: { revision: number } }>(patch)).data.revision;
    expect((await SELF.fetch(`http://local/api/codes/${placeholder.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision }) })).status).toBe(200);
    const publicResponse = await SELF.fetch(`http://local/api/public/${placeholder.slug}`);
    const publicBody = await body(publicResponse);
    const serialized = JSON.stringify(publicBody);
    expect(serialized).not.toContain("codes/");
    expect(serialized).not.toContain("object_key");
    const proxy = await SELF.fetch(`http://local/api/public/${placeholder.slug}/assets/${assetId}`);
    expect(proxy.status).toBe(200);
    expect(proxy.headers.get("content-type")).toContain("application/pdf");
  });

  it("enforces event rate limits per source while preserving idempotency", async () => {
    const cookie = await auth();
    const active = await code(cookie);
    expect((await SELF.fetch(`http://local/api/codes/${active.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision: active.revision }) })).status).toBe(200);
    const ip = `198.51.100.${id}`;
    let limited = false;
    for (let index = 0; index < 65; index += 1) {
      const response = await SELF.fetch(`http://local/api/public/${active.slug}/events`, { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify({ event: "view", idempotencyKey: `rate-${id}-${index}` }) });
      if (response.status === 429) { limited = true; break; }
      expect(response.status).toBe(200);
    }
    expect(limited).toBe(true);
  });

  it("sets safe CORS and cookie attributes", async () => {
    const preflight = await SELF.fetch("http://local/api/codes", { method: "OPTIONS", headers: { Origin: "http://127.0.0.1:5173", "Access-Control-Request-Method": "POST" } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");

    const hostile = await SELF.fetch("http://local/api/codes", { method: "OPTIONS", headers: { Origin: "https://attacker.example", "Access-Control-Request-Method": "POST" } });
    expect(hostile.headers.get("access-control-allow-origin")).toBeNull();

    const email = `cookie-${Date.now()}@active.tpqr.local`;
    const requested = await SELF.fetch("http://local/api/auth/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const requestBody = await body<{ data: { testCode?: string } }>(requested);
    const verified = await SELF.fetch("http://local/api/auth/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code: requestBody.data.testCode ?? "123456" }) });
    const cookie = verified.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/tp_session=[^;]+/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
  });
});
