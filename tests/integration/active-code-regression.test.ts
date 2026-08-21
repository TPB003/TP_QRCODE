import { SELF, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

type Envelope<T = Record<string, unknown>> = {
  data?: T;
  error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> };
};
type Cookie = string;
type Code = { id: string; slug: string; revision: number; publishedVersion?: number | null; title: string; content: Record<string, unknown>; render?: Record<string, unknown> };

async function json<T extends Envelope = Envelope>(response: Response): Promise<T> {
  return await response.json();
}

let sequence = 0;

async function login(label: string): Promise<Cookie> {
  sequence += 1;
  const email = `${label}-${sequence}@regression.tpqr.local`;
  const request = await SELF.fetch("http://local/api/auth/request-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  expect(request.status).toBe(200);
  const requestBody = await json<{ data: { testCode?: string } }>(request);
  const verify = await SELF.fetch("http://local/api/auth/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code: requestBody.data?.testCode ?? "123456" }),
  });
  expect(verify.status).toBe(200);
  return verify.headers.get("set-cookie") ?? "";
}

async function createCode(cookie: Cookie, content: Record<string, unknown> = { type: "text", title: "回归测试", text: "稳定性测试" }): Promise<Code> {
  const response = await SELF.fetch("http://local/api/codes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ title: "回归活码", content }),
  });
  expect(response.status).toBe(201);
  const data = (await json<{ data: Code }>(response)).data;
  if (!data) throw new Error("创建回归活码没有返回 data");
  return data;
}

async function publish(cookie: Cookie, code: Pick<Code, "id" | "revision">): Promise<Response> {
  return SELF.fetch(`http://local/api/codes/${code.id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ revision: code.revision }),
  });
}

describe("active code regression contracts", () => {
  beforeAll(async () => {
    const database = (env as unknown as { DB: D1Database }).DB;
    await database.exec("DELETE FROM qr_access_events; DELETE FROM analytics_daily_codes; DELETE FROM qr_code_assets; DELETE FROM qr_code_versions; DELETE FROM qr_codes;");
  });

  it("records scan and view events idempotently across retries", async () => {
    const cookie = await login("events");
    const code = await createCode(cookie);
    expect((await publish(cookie, code)).status).toBe(200);

    const scanKey = `scan-regression-${sequence}-unique`;
    const firstRead = await SELF.fetch(`http://local/api/public/${code.slug}`, { headers: { "X-Idempotency-Key": scanKey } });
    const retryRead = await SELF.fetch(`http://local/api/public/${code.slug}`, { headers: { "X-Idempotency-Key": scanKey } });
    expect(firstRead.status).toBe(200);
    expect(retryRead.status).toBe(200);

    const viewKey = `view-regression-${sequence}-unique`;
    const firstView = await SELF.fetch(`http://local/api/public/${code.slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "view", idempotencyKey: viewKey }),
    });
    const retryView = await SELF.fetch(`http://local/api/public/${code.slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "view", idempotencyKey: viewKey }),
    });
    expect(firstView.status).toBe(200);
    expect(retryView.status).toBe(200);
    expect((await json<{ data: { accepted: boolean; duplicate: boolean } }>(firstView)).data).toMatchObject({ accepted: true, duplicate: false });
    expect((await json<{ data: { accepted: boolean; duplicate: boolean } }>(retryView)).data).toMatchObject({ accepted: true, duplicate: true });

    const analytics = await SELF.fetch(`http://local/api/codes/${code.id}/analytics?days=30`, { headers: { Cookie: cookie } });
    expect(analytics.status).toBe(200);
    const rows = (await json<{ data: { items: Array<{ scans: number; views: number }> } }>(analytics)).data?.items ?? [];
    expect(rows.reduce((sum, row) => sum + Number(row.scans), 0)).toBe(1);
    expect(rows.reduce((sum, row) => sum + Number(row.views), 0)).toBe(1);
  });

  it("serves public assets as attachments when download=1 is requested", async () => {
    const cookie = await login("download");
    const code = await createCode(cookie);
    const form = new FormData();
    form.set("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])], "report.pdf", { type: "application/pdf" }));
    const uploaded = await SELF.fetch(`http://local/api/codes/${code.id}/assets`, { method: "POST", headers: { Cookie: cookie }, body: form });
    expect(uploaded.status).toBe(201);
    const assetId = (await json<{ data: { id: string } }>(uploaded)).data?.id;
    expect(assetId).toBeTruthy();
    const updated = await SELF.fetch(`http://local/api/codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ revision: code.revision, content: { type: "file", assetId, title: "下载测试", description: "", downloadName: "report.pdf" } }),
    });
    expect(updated.status).toBe(200);
    const updatedCode = (await json<{ data: Code }>(updated)).data;
    if (!updatedCode) throw new Error("更新回归活码没有返回 data");
    expect((await publish(cookie, updatedCode)).status).toBe(200);

    const download = await SELF.fetch(`http://local/api/public/${code.slug}/assets/${assetId}?download=1`);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toContain("application/pdf");
    expect(download.headers.get("content-disposition")).toMatch(/attachment/i);
    expect(download.headers.get("content-disposition")).not.toMatch(/object[_-]?key|codes\//i);
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]));
  });

  it("returns field-level validation errors for invalid content updates", async () => {
    const cookie = await login("validation");
    const code = await createCode(cookie, { type: "url", title: "安全网址", url: "https://example.com", description: "" });
    const response = await SELF.fetch(`http://local/api/codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ revision: code.revision, content: { type: "url", title: "危险网址", url: "javascript:alert(1)", description: "" } }),
    });
    expect(response.status).toBe(422);
    const body = await json(response);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.fieldErrors).toBeDefined();
    expect(body.error?.fieldErrors?.["content.url"]?.length).toBeGreaterThan(0);
  });

  it("does not increment revision when settings/content are unchanged", async () => {
    const cookie = await login("settings");
    const code = await createCode(cookie);
    const unchanged = await SELF.fetch(`http://local/api/codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ revision: code.revision, title: code.title, content: code.content, render: code.render }),
    });
    expect(unchanged.status).toBe(200);
    const unchangedCode = (await json<{ data: Code }>(unchanged)).data;
    if (!unchangedCode) throw new Error("设置回归活码没有返回 data");
    expect(unchangedCode.revision).toBe(code.revision);

    const changed = await SELF.fetch(`http://local/api/codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ revision: unchangedCode.revision, title: "设置已更新" }),
    });
    expect(changed.status).toBe(200);
    const changedCode = (await json<{ data: Code }>(changed)).data;
    if (!changedCode) throw new Error("更新设置没有返回 data");
    expect(changedCode.revision).toBe(code.revision + 1);
  });

  it("keeps the published version number separate and current after each release", async () => {
    const cookie = await login("versions");
    const code = await createCode(cookie);

    const firstPublish = await publish(cookie, code);
    expect(firstPublish.status).toBe(200);
    const firstBody = (await json<{ data: { version: { version: number; revision: number } } }>(firstPublish)).data;
    expect(firstBody?.version.version).toBe(1);
    const firstRead = await SELF.fetch(`http://local/api/codes/${code.id}`, { headers: { Cookie: cookie } });
    expect((await json<{ data: Code }>(firstRead)).data?.publishedVersion).toBe(1);

    const changed = await SELF.fetch(`http://local/api/codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ revision: code.revision, title: "第二版活码" }),
    });
    expect(changed.status).toBe(200);
    const changedCode = (await json<{ data: Code }>(changed)).data;
    if (!changedCode) throw new Error("版本回归更新没有返回 data");

    const secondPublish = await publish(cookie, changedCode);
    expect(secondPublish.status).toBe(200);
    const secondBody = (await json<{ data: { version: { version: number; revision: number } } }>(secondPublish)).data;
    expect(secondBody?.version.version).toBe(2);
    const secondRead = await SELF.fetch(`http://local/api/codes/${code.id}`, { headers: { Cookie: cookie } });
    const secondCode = (await json<{ data: Code }>(secondRead)).data;
    expect(secondCode?.publishedVersion).toBe(2);
    expect(secondCode?.revision).toBe(changedCode.revision);
  });
});
