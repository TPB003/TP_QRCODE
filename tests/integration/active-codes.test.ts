import { SELF, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

type JsonBody<T = Record<string, unknown>> = { data?: T; error?: { code: string; message?: string; fieldErrors?: Record<string, string[]> } };
type CookieJar = string;
type CodePayload = { id: string; slug: string; revision: number; status: string; content: Record<string, unknown> };
type PublicPayload = { code: { contentType: string; content: Record<string, unknown> }; assets: Array<{ id: string; url: string }> };

async function json<T extends JsonBody = JsonBody>(response: Response): Promise<T> {
  const value: unknown = await response.json();
  return value as T;
}

let sequence = 0;
async function login(label = "integration"): Promise<CookieJar> {
  sequence += 1;
  const email = `${label}-${sequence}@active.tpqr.local`;
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
  const cookie = verify.headers.get("set-cookie");
  expect(cookie).toMatch(/tp_session=/);
  return cookie ?? "";
}

async function createCode(cookie: CookieJar, content: Record<string, unknown> = { type: "text", title: "集成测试", text: "hello" }) {
  const response = await SELF.fetch("http://local/api/codes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ title: "Active code integration", content }),
  });
  expect(response.status).toBe(201);
  const body = await json<{ data: CodePayload }>(response);
  return body.data;
}

async function publish(cookie: CookieJar, code: { id: string; revision: number }) {
  return SELF.fetch(`http://local/api/codes/${code.id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ revision: code.revision }),
  });
}

describe("active QR code API", () => {
  beforeAll(async () => {
    const database = (env as unknown as { DB: D1Database }).DB;
    // Do not touch legacy project fixtures. These rows are isolated by the new tables.
    await database.exec("DELETE FROM qr_access_events; DELETE FROM analytics_daily_codes; DELETE FROM qr_code_assets; DELETE FROM qr_code_versions; DELETE FROM qr_codes;");
  });

  it("creates, lists, updates with revision protection, previews, publishes and reads text, URL and contact content", async () => {
    const cookie = await login("lifecycle");
    const payloads: Array<Record<string, unknown>> = [
      { type: "text", title: "文字", text: "你好，TP QR" },
      { type: "url", title: "网址", url: "https://example.com/path" },
      { type: "contact", firstName: "TP", lastName: "QR", email: "hello@example.com" },
    ];

    for (const payload of payloads) {
      const code = await createCode(cookie, payload);
      const detail = await SELF.fetch(`http://local/api/codes/${code.id}`, { headers: { Cookie: cookie } });
      expect(detail.status).toBe(200);
      expect((await json<{ data: CodePayload }>(detail)).data.content.type).toBe(payload.type);

      const stale = await SELF.fetch(`http://local/api/codes/${code.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ revision: 99, title: "stale" }),
      });
      expect(stale.status).toBe(409);
      expect((await json<{ error: { code: string } }>(stale)).error.code).toBe("REVISION_CONFLICT");

      const update = await SELF.fetch(`http://local/api/codes/${code.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ revision: code.revision, title: `${String(payload.type)} updated`, content: payload }),
      });
      expect(update.status).toBe(200);
      const updated = (await json<{ data: { revision: number } }>(update)).data;
      const preview = await SELF.fetch(`http://local/api/codes/${code.id}/preview`, { method: "POST", headers: { Cookie: cookie } });
      expect(preview.status).toBe(200);
      expect((await json<{ data: { preview: boolean } }>(preview)).data.preview).toBe(true);

      const published = await publish(cookie, { id: code.id, revision: updated.revision });
      expect(published.status).toBe(200);
      expect((await json<{ data: { version: { version: number } } }>(published)).data.version.version).toBe(1);
      const publicRead = await SELF.fetch(`http://local/api/public/${code.slug}`);
      expect(publicRead.status).toBe(200);
      const publicBody = await json<{ data: PublicPayload }>(publicRead);
      expect(publicBody.data.code.contentType).toBe(payload.type);
      expect(publicBody.data.code.content.type).toBe(payload.type);
    }

    const list = await SELF.fetch("http://local/api/codes", { headers: { Cookie: cookie } });
    expect(list.status).toBe(200);
    expect((await json<{ data: { items: CodePayload[] } }>(list)).data.items.length).toBeGreaterThanOrEqual(3);
  });

  it("publishes image, video, audio and file content types with their assets", async () => {
    const cookie = await login("media-lifecycle");
    const media: Array<{ type: "image" | "video" | "audio" | "file"; mime: string; name: string; bytes: number[] }> = [
      { type: "image", mime: "image/png", name: "pixel.png", bytes: [0x89, 0x50, 0x4e, 0x47] },
      { type: "video", mime: "video/mp4", name: "clip.mp4", bytes: [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70] },
      { type: "audio", mime: "audio/mpeg", name: "sound.mp3", bytes: [0x49, 0x44, 0x33] },
      { type: "file", mime: "application/pdf", name: "brief.pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
    ];
    for (const item of media) {
      const code = await createCode(cookie);
      const form = new FormData();
      form.set("file", new File([new Uint8Array(item.bytes)], item.name, { type: item.mime }));
      const uploaded = await SELF.fetch(`http://local/api/codes/${code.id}/assets`, { method: "POST", headers: { Cookie: cookie }, body: form });
      expect(uploaded.status).toBe(201);
      const assetId = (await json<{ data: { id: string } }>(uploaded)).data.id;
      const content: Record<string, unknown> = item.type === "image"
        ? { type: item.type, assetId, alt: "媒体资源" }
        : item.type === "video"
          ? { type: item.type, assetId, title: "视频" }
          : item.type === "audio"
            ? { type: item.type, assetId, title: "音频", artist: "TP QR" }
            : { type: item.type, assetId, title: "文件", description: "测试文件", downloadName: item.name };
      const updated = await SELF.fetch(`http://local/api/codes/${code.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision: code.revision, content }) });
      expect(updated.status).toBe(200);
      const revision = (await json<{ data: { revision: number } }>(updated)).data.revision;
      expect((await publish(cookie, { id: code.id, revision })).status).toBe(200);
      const publicResponse = await SELF.fetch(`http://local/api/public/${code.slug}`);
      expect(publicResponse.status).toBe(200);
      const publicData = (await json<{ data: PublicPayload }>(publicResponse)).data;
      expect(publicData.code.contentType).toBe(item.type);
      expect(publicData.assets.some((asset) => asset.id === assetId)).toBe(true);
    }
  });

  it("supports media/file assets, magic-byte checks and owner isolation", async () => {
    const owner = await login("asset-owner");
    const code = await createCode(owner, { type: "text", title: "asset holder", text: "placeholder" });

    const invalid = new FormData();
    invalid.set("file", new File([new Uint8Array([1, 2, 3, 4])], "not-a-png.png", { type: "image/png" }));
    const rejected = await SELF.fetch(`http://local/api/codes/${code.id}/assets`, { method: "POST", headers: { Cookie: owner }, body: invalid });
    expect(rejected.status).toBe(422);
    expect((await json<{ error: { code: string } }>(rejected)).error.code).toBe("UPLOAD_REJECTED");

    const upload = new FormData();
    upload.set("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "pixel.png", { type: "image/png" }));
    const uploaded = await SELF.fetch(`http://local/api/codes/${code.id}/assets`, { method: "POST", headers: { Cookie: owner }, body: upload });
    expect(uploaded.status).toBe(201);
    const assetId = (await json<{ data: { id: string } }>(uploaded)).data.id;

    const other = await login("asset-other");
    const otherCode = await createCode(other);
    const crossPatch = await SELF.fetch(`http://local/api/codes/${otherCode.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: other },
      body: JSON.stringify({ revision: otherCode.revision, content: { type: "image", assetId, alt: "stolen" } }),
    });
    expect(crossPatch.status).toBe(422);
    expect((await json<{ error: { code: string } }>(crossPatch)).error.code).toBe("UPLOAD_REJECTED");

    const ownerPatch = await SELF.fetch(`http://local/api/codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: owner },
      body: JSON.stringify({ revision: code.revision, content: { type: "image", assetId, alt: "pixel" } }),
    });
    expect(ownerPatch.status).toBe(200);
    const published = await publish(owner, { id: code.id, revision: (await json<{ data: { revision: number } }>(ownerPatch)).data.revision });
    expect(published.status).toBe(200);
    const publicBody = await json<{ data: PublicPayload }>(await SELF.fetch(`http://local/api/public/${code.slug}`));
    const asset = publicBody.data.assets.find((item) => item.id === assetId);
    expect(asset).toBeDefined();
    expect(asset?.url).toBe(`/api/public/${code.slug}/assets/${assetId}`);
    expect(asset?.url).not.toContain("codes/");
    const proxy = await SELF.fetch(`http://local${asset?.url ?? ""}`);
    expect(proxy.status).toBe(200);
    expect(proxy.headers.get("content-type")).toContain("image/png");
    expect(new Uint8Array(await proxy.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  });

  it("hides unpublished, paused and deleted codes and prevents cross-user access", async () => {
    const owner = await login("visibility-owner");
    const code = await createCode(owner);
    expect((await SELF.fetch(`http://local/api/public/${code.slug}`)).status).toBe(404);

    const paused = await SELF.fetch(`http://local/api/codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: owner },
      body: JSON.stringify({ revision: code.revision, status: "paused" }),
    });
    expect(paused.status).toBe(200);
    expect((await SELF.fetch(`http://local/api/public/${code.slug}`)).status).toBe(404);

    const other = await login("visibility-other");
    expect((await SELF.fetch(`http://local/api/codes/${code.id}`, { headers: { Cookie: other } })).status).toBe(404);
    expect((await SELF.fetch(`http://local/api/codes/${code.id}`, { method: "DELETE", headers: { Cookie: other } })).status).toBe(404);

    const deleted = await SELF.fetch(`http://local/api/codes/${code.id}`, { method: "DELETE", headers: { Cookie: owner } });
    expect(deleted.status).toBe(200);
    expect((await SELF.fetch(`http://local/api/public/${code.slug}`)).status).toBe(404);
    expect((await SELF.fetch("http://local/api/public/does-not-exist")).status).toBe(404);
  });

  it("records idempotent events and exposes daily analytics", async () => {
    const cookie = await login("events");
    const code = await createCode(cookie);
    expect((await publish(cookie, code)).status).toBe(200);
    expect((await SELF.fetch(`http://local/api/public/${code.slug}`)).status).toBe(200);
    const event = { event: "download", idempotencyKey: `download-${sequence}-unique` };
    const first = await SELF.fetch(`http://local/api/public/${code.slug}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event) });
    const second = await SELF.fetch(`http://local/api/public/${code.slug}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event) });
    expect(first.status).toBe(200);
    expect((await json<{ data: { accepted: boolean; duplicate: boolean } }>(first)).data).toMatchObject({ accepted: true, duplicate: false });
    expect(second.status).toBe(200);
    expect((await json<{ data: { accepted: boolean; duplicate: boolean } }>(second)).data).toMatchObject({ accepted: true, duplicate: true });

    const analytics = await SELF.fetch(`http://local/api/codes/${code.id}/analytics?days=30`, { headers: { Cookie: cookie } });
    expect(analytics.status).toBe(200);
    const rows = (await json<{ data: { items: Array<{ scans: number; downloads: number }> } }>(analytics)).data.items;
    expect(rows.reduce((sum, row) => sum + Number(row.scans), 0)).toBeGreaterThanOrEqual(1);
    expect(rows.reduce((sum, row) => sum + Number(row.downloads), 0)).toBe(1);
  });
});
