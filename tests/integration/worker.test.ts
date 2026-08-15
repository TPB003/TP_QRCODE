import { SELF, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

interface TestEnvironment {
  DB: D1Database;
}

interface AuthCodeResponse {
  data: { testCode?: string };
}

interface CreateProjectResponse {
  data: { project: { id: string; revision: number; visualStyle?: { foreground: string; background: string; dotStyle: string; cornerSquareStyle: string; cornerDotStyle: string; logoAssetId: string | null; frameText: string } }; entity: { slug: string } };
}

interface UpdateProjectResponse {
  data: { revision: number };
}

interface PublicResponse {
  data: {
    project: { name: string; content: { type: string; templateKey?: string; schema?: { fields: Array<{ id: string; type: string; required: boolean; options?: string[] }> } } };
    entity: { slug: string };
  };
}

interface SubmissionResponse {
  data: { id: string; attachments?: Array<{ url: string; contentType: string }> };
}

async function json<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  return body as T;
}

async function login(email = "integration@tpqr.local"): Promise<string> {
  const requestCode = await SELF.fetch("http://local/api/auth/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  expect(requestCode.status).toBe(200);
  const requestBody = await json<AuthCodeResponse>(requestCode);
  const code = requestBody.data.testCode ?? "123456";
  const verify = await SELF.fetch("http://local/api/auth/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
  expect(verify.status).toBe(200);
  return verify.headers.get("set-cookie") ?? "";
}

describe("TP QR Worker API", () => {
  beforeAll(async () => {
    const testEnv = env as unknown as TestEnvironment;
    await testEnv.DB.exec("DELETE FROM submissions; DELETE FROM project_versions; DELETE FROM entity_codes; DELETE FROM projects; DELETE FROM sessions; DELETE FROM auth_codes; DELETE FROM users;");
  });

  it("reports health without authentication", async () => {
    const response = await SELF.fetch("http://local/api/health");
    expect(response.status).toBe(200);
    const body = await json<{ data: { status: string } }>(response);
    expect(body.data.status).toBe("ok");
  });

  it("serves the SPA shell for public scan routes", async () => {
    const response = await SELF.fetch("http://local/s/TPQRDEMO01", { headers: { "Sec-Fetch-Mode": "navigate" } });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="root"></div>');
  });

  it("runs auth, project, publish and public read flow", async () => {
    const cookie = await login();
    const create = await SELF.fetch("http://local/api/projects", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ name: "集成测试巡检", kind: "business", templateKey: "inspection" }) });
    expect(create.status).toBe(201);
    const created = await json<CreateProjectResponse>(create);
    const projectId = created.data.project.id;
    const slug = created.data.entity.slug;
    const update = await SELF.fetch(`http://local/api/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision: 0, name: "集成测试巡检（已编辑）" }) });
    expect(update.status).toBe(200);
    const updated = await json<UpdateProjectResponse>(update);
    const publish = await SELF.fetch(`http://local/api/projects/${projectId}/publish`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision: updated.data.revision }) });
    expect(publish.status).toBe(200);
    const publicPage = await SELF.fetch(`http://local/api/public/${slug}`);
    expect(publicPage.status).toBe(200);
    const payload = await json<PublicResponse>(publicPage);
    expect(payload.data.project.name).toContain("集成测试");
    expect(payload.data.entity.slug).toBe(slug);
    const fields = payload.data.project.content.schema?.fields ?? [];
    const values = Object.fromEntries(fields.filter((field) => field.required).map((field) => [field.id, field.type === "date" ? "2026-08-14" : field.type === "singleChoice" ? field.options?.[0] : field.type === "number" ? "1" : field.type === "email" ? "integration@tpqr.local" : field.type === "phone" ? "13800138000" : "local integration test"]));
    const choiceField = fields.find((field) => field.type === "singleChoice");
    if (choiceField) {
      const invalidChoice = await SELF.fetch(`http://local/api/public/${slug}/submissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: { ...values, [choiceField.id]: "not-a-real-option" } }) });
      expect(invalidChoice.status).toBe(422);
    }
    const submission = await SELF.fetch(`http://local/api/public/${slug}/submissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values }) });
    expect(submission.status).toBe(201);
    const multipart = new FormData();
    multipart.set("values", JSON.stringify(values));
    multipart.append("files", new File([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])], "evidence.webp", { type: "image/webp" }));
    const multipartSubmission = await SELF.fetch(`http://local/api/public/${slug}/submissions`, { method: "POST", body: multipart });
    expect(multipartSubmission.status).toBe(201);
    const multipartBody = await json<SubmissionResponse>(multipartSubmission);
    const detail = await SELF.fetch(`http://local/api/projects/${projectId}/submissions/${multipartBody.data.id}`, { headers: { Cookie: cookie } });
    expect(detail.status).toBe(200);
    const detailBody = await json<SubmissionResponse>(detail);
    expect(detailBody.data.attachments?.length).toBe(1);
    const attachment = detailBody.data.attachments?.[0];
    expect(attachment?.contentType).toBe("image/webp");
    const attachmentResponse = await SELF.fetch(`http://local${attachment?.url ?? ""}`, { headers: { Cookie: cookie } });
    expect(attachmentResponse.status).toBe(200);
    expect(attachmentResponse.headers.get("content-type")).toContain("image/webp");
  });

  it("rejects stale revisions and unauthenticated management access", async () => {
    const unauthorized = await SELF.fetch("http://local/api/projects");
    expect(unauthorized.status).toBe(401);
    const cookie = await login();
    const create = await SELF.fetch("http://local/api/projects", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ name: "版本冲突测试", kind: "text" }) });
    const projectId = (await json<CreateProjectResponse>(create)).data.project.id;
    const stale = await SELF.fetch(`http://local/api/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision: 99, name: "错误版本" }) });
    expect(stale.status).toBe(409);
  });

  it("creates and accepts all four business templates", async () => {
    const cookie = await login("templates@tpqr.local");
    for (const templateKey of ["checkin", "personnel", "inspection", "collection"] as const) {
      const create = await SELF.fetch("http://local/api/projects", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ name: `模板验收-${templateKey}`, kind: "business", templateKey }) });
      expect(create.status).toBe(201);
      const created = await json<CreateProjectResponse>(create);
      const publish = await SELF.fetch(`http://local/api/projects/${created.data.project.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision: 0 }) });
      expect(publish.status).toBe(200);
      const publicPage = await SELF.fetch(`http://local/api/public/${created.data.entity.slug}`);
      expect(publicPage.status).toBe(200);
      const payload = await json<PublicResponse>(publicPage);
      expect(payload.data.project.content.templateKey).toBe(templateKey);
      const fields = payload.data.project.content.schema?.fields ?? [];
      const values: Record<string, unknown> = {};
      for (const field of fields) {
        if (!field.required) continue;
        if (field.type === "singleChoice") values[field.id] = field.options?.[0] ?? "";
        else if (field.type === "multipleChoice") values[field.id] = [field.options?.[0] ?? ""];
        else if (field.type === "date") values[field.id] = "2026-08-15";
        else if (field.type === "dateTime") values[field.id] = "2026-08-15T10:00:00.000Z";
        else if (field.type === "number") values[field.id] = "1";
        else if (field.type === "email") values[field.id] = "templates@tpqr.local";
        else if (field.type === "phone") values[field.id] = "13800138000";
        else values[field.id] = "模板验收";
      }
      const submission = await SELF.fetch(`http://local/api/public/${created.data.entity.slug}/submissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values }) });
      expect(submission.status).toBe(201);
    }
  });

  it("prevents cross-user asset references", async () => {
    const ownerCookie = await login("asset-owner@tpqr.local");
    const upload = new FormData();
    upload.set("purpose", "logo");
    upload.set("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "logo.png", { type: "image/png" }));
    const assetResponse = await SELF.fetch("http://local/api/assets", { method: "POST", headers: { Cookie: ownerCookie }, body: upload });
    expect(assetResponse.status).toBe(201);
    const assetId = (await json<{ data: { id: string } }>(assetResponse)).data.id;
    const otherCookie = await login("asset-other@tpqr.local");
    const create = await SELF.fetch("http://local/api/projects", { method: "POST", headers: { "Content-Type": "application/json", Cookie: otherCookie }, body: JSON.stringify({ name: "资源权限测试", kind: "text" }) });
    const created = await json<CreateProjectResponse>(create);
    const project = await SELF.fetch(`http://local/api/projects/${created.data.project.id}`, { headers: { Cookie: otherCookie } });
    const current = (await json<{ data: { project: CreateProjectResponse["data"]["project"] } }>(project)).data.project;
    const visualStyle = { ...(current.visualStyle ?? { foreground: "#2563EB", background: "#FBF9F3", dotStyle: "rounded", cornerSquareStyle: "extra-rounded", cornerDotStyle: "dot", logoAssetId: null, frameText: "" }), logoAssetId: assetId };
    const patch = await SELF.fetch(`http://local/api/projects/${created.data.project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: otherCookie }, body: JSON.stringify({ revision: 0, visualStyle }) });
    expect(patch.status).toBe(422);
  });

  it("publishes image QR assets only after upload and serves them publicly", async () => {
    const cookie = await login("image-qr@tpqr.local");
    const create = await SELF.fetch("http://local/api/projects", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ name: "图片二维码验收", kind: "image" }) });
    expect(create.status).toBe(201);
    const created = await json<CreateProjectResponse>(create);
    const projectId = created.data.project.id;

    const missingAssetPublish = await SELF.fetch(`http://local/api/projects/${projectId}/publish`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision: 0 }) });
    expect(missingAssetPublish.status).toBe(422);

    const upload = new FormData();
    upload.set("purpose", "image");
    upload.set("file", new File([new Uint8Array([137, 80, 78, 71])], "inspection.png", { type: "image/png" }));
    const uploaded = await SELF.fetch("http://local/api/assets", { method: "POST", headers: { Cookie: cookie }, body: upload });
    expect(uploaded.status).toBe(201);
    const assetId = (await json<{ data: { id: string } }>(uploaded)).data.id;

    const update = await SELF.fetch(`http://local/api/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision: 0, content: { type: "image", assetId } }) });
    expect(update.status).toBe(200);
    const updated = await json<UpdateProjectResponse>(update);
    const publish = await SELF.fetch(`http://local/api/projects/${projectId}/publish`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ revision: updated.data.revision }) });
    expect(publish.status).toBe(200);

    const publicAsset = await SELF.fetch(`http://local/api/public-assets/${assetId}`);
    expect(publicAsset.status).toBe(200);
    expect(publicAsset.headers.get("content-type")).toContain("image/png");
    expect(Array.from(new Uint8Array(await publicAsset.arrayBuffer()))).toEqual([137, 80, 78, 71]);

    const deleteReferenced = await SELF.fetch(`http://local/api/assets/${assetId}`, { method: "DELETE", headers: { Cookie: cookie } });
    expect(deleteReferenced.status).toBe(409);
    const missingPublicAsset = await SELF.fetch("http://local/api/public-assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(missingPublicAsset.status).toBe(404);
  });

  it("covers management list, templates, asset lifecycle, analytics and logout", async () => {
    const cookie = await login("management@tpqr.local");
    const templates = await SELF.fetch("http://local/api/templates");
    expect(templates.status).toBe(200);
    expect((await json<{ data: Array<{ key: string }> }>(templates)).data).toHaveLength(4);
    const projects = await SELF.fetch("http://local/api/projects", { headers: { Cookie: cookie } });
    expect(projects.status).toBe(200);
    const created = await SELF.fetch("http://local/api/projects", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ name: "管理接口测试", kind: "text" }) });
    const project = await json<CreateProjectResponse>(created);
    const assetForm = new FormData();
    assetForm.set("purpose", "logo");
    assetForm.set("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "logo.png", { type: "image/png" }));
    const uploaded = await SELF.fetch("http://local/api/assets", { method: "POST", headers: { Cookie: cookie }, body: assetForm });
    expect(uploaded.status).toBe(201);
    const assetId = (await json<{ data: { id: string } }>(uploaded)).data.id;
    const asset = await SELF.fetch(`http://local/api/assets/${assetId}`, { headers: { Cookie: cookie } });
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("image/png");
    const analytics = await SELF.fetch(`http://local/api/projects/${project.data.project.id}/analytics?days=abc`, { headers: { Cookie: cookie } });
    expect(analytics.status).toBe(422);
    const deleted = await SELF.fetch(`http://local/api/assets/${assetId}`, { method: "DELETE", headers: { Cookie: cookie } });
    expect(deleted.status).toBe(200);
    const missingAsset = await SELF.fetch(`http://local/api/assets/${assetId}`, { headers: { Cookie: cookie } });
    expect(missingAsset.status).toBe(404);
    const logout = await SELF.fetch("http://local/api/auth/logout", { method: "POST", headers: { Cookie: cookie } });
    expect(logout.status).toBe(200);
    const me = await SELF.fetch("http://local/api/auth/me", { headers: { Cookie: cookie } });
    expect(me.status).toBe(401);
  });
});
