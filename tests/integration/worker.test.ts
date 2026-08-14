import { SELF, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

interface TestEnvironment {
  DB: D1Database;
}

interface AuthCodeResponse {
  data: { testCode?: string };
}

interface CreateProjectResponse {
  data: { project: { id: string; revision: number }; entity: { slug: string } };
}

interface UpdateProjectResponse {
  data: { revision: number };
}

interface PublicResponse {
  data: {
    project: { name: string; content: { type: string; schema?: { fields: Array<{ id: string; type: string; required: boolean }> } } };
    entity: { slug: string };
  };
}

async function json<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  return body as T;
}

async function login(): Promise<string> {
  const requestCode = await SELF.fetch("http://local/api/auth/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "integration@tpqr.local" }) });
  expect(requestCode.status).toBe(200);
  const requestBody = await json<AuthCodeResponse>(requestCode);
  const code = requestBody.data.testCode ?? "123456";
  const verify = await SELF.fetch("http://local/api/auth/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "integration@tpqr.local", code }) });
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
    const values = Object.fromEntries(fields.filter((field) => field.required).map((field) => [field.id, field.type === "date" ? "2026-08-14" : "local integration test"]));
    const submission = await SELF.fetch(`http://local/api/public/${slug}/submissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values }) });
    expect(submission.status).toBe(201);
    const multipart = new FormData();
    multipart.set("values", JSON.stringify(values));
    multipart.append("files", new File([new Uint8Array([1, 2, 3])], "evidence.webp", { type: "image/webp" }));
    const multipartSubmission = await SELF.fetch(`http://local/api/public/${slug}/submissions`, { method: "POST", body: multipart });
    expect(multipartSubmission.status).toBe(201);
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
});
