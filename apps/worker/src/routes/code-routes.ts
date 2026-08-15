import { Hono } from "hono";
import { z } from "zod";
import {
  ACTIVE_CONTENT_TYPES,
  activeContentSchema,
  type ActiveContent,
  type PublicContentResponse,
  type QrRenderConfig,
} from "@tpqr/domain";
import type { Bindings } from "@worker/bindings";
import { currentUser } from "@worker/lib/auth";
import { apiError, consumeRateLimit, hashValue, jsonParse, nowIso, randomSlug, readJson, type AppContext } from "@worker/lib/http";

export const codeRoutes = new Hono<{ Bindings: Bindings }>();
export const publicCodeRoutes = new Hono<{ Bindings: Bindings }>();

const idSchema = z.string().uuid();
const renderSchema = z.object({
  size: z.number().int().min(128).max(2048).default(512),
  margin: z.number().int().min(0).max(64).default(16),
  foreground: z.string().regex(/^#[0-9a-f]{6}$/i).default("#2563EB"),
  background: z.string().regex(/^#[0-9a-f]{6}$/i).default("#FBF9F3"),
  dotStyle: z.enum(["square", "rounded", "dots", "classy", "classy-rounded", "extra-rounded"]).default("rounded"),
  cornerSquareStyle: z.enum(["square", "dot", "extra-rounded"]).default("extra-rounded"),
  cornerDotStyle: z.enum(["square", "dot", "extra-rounded"]).default("dot"),
  logoAssetId: z.string().uuid().nullable().optional().default(null),
  logoSize: z.number().int().min(0).max(40).optional(),
  errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]).optional().default("M"),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: activeContentSchema,
  render: renderSchema.partial().optional(),
});
const updateSchema = createSchema.partial().extend({ revision: z.number().int().nonnegative(), status: z.enum(["active", "paused"]).optional() });
const publishSchema = z.object({ revision: z.number().int().nonnegative() });
const eventSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  event: z.enum(["scan", "view", "click", "download", "play"]),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

type CodeRow = {
  id: string; owner_id: string; slug: string; title: string; content_type: string;
  draft_content_json: string; draft_render_json: string; revision: number; status: "active" | "paused" | "deleted";
  published_version_id: string | null; created_at: string; updated_at: string; deleted_at: string | null;
};
type VersionRow = { id: string; code_id: string; version: number; revision: number; content_json: string; render_json: string; created_at: string; published_at: string };

function defaultRender(): QrRenderConfig {
  return { size: 512, margin: 16, foreground: "#2563EB", background: "#FBF9F3", dotStyle: "rounded", cornerSquareStyle: "extra-rounded", cornerDotStyle: "dot", logoAssetId: null, errorCorrectionLevel: "M" };
}
function codePayload(row: CodeRow) {
  return {
    id: row.id, slug: row.slug, title: row.title, contentType: row.content_type,
    content: jsonParse<ActiveContent>(row.draft_content_json, { type: "text", title: "", text: "" }),
    render: jsonParse<QrRenderConfig>(row.draft_render_json, defaultRender()), revision: row.revision,
    status: row.status, publishedVersionId: row.published_version_id, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
async function ownedCode(context: AppContext, id: string, ownerId: string): Promise<CodeRow | null> {
  return context.env.DB.prepare("SELECT * FROM qr_codes WHERE id = ? AND owner_id = ? AND deleted_at IS NULL LIMIT 1").bind(id, ownerId).first<CodeRow>();
}
function referencedAssetIds(content: ActiveContent, render: QrRenderConfig): string[] {
  const ids: Array<string | null | undefined> = [render.logoAssetId];
  if ("assetId" in content) ids.push(content.assetId);
  if (content.type === "video") ids.push(content.posterAssetId);
  if (content.type === "audio") ids.push(content.coverAssetId);
  return ids.filter((id): id is string => Boolean(id));
}
async function assertOwnedAssets(context: AppContext, content: ActiveContent, render: QrRenderConfig, ownerId: string): Promise<boolean> {
  const ids = referencedAssetIds(content, render);
  if (!ids.length) return true;
  const placeholders = ids.map(() => "?").join(",");
  const row = await context.env.DB.prepare(`SELECT COUNT(*) AS count FROM assets WHERE owner_id = ? AND id IN (${placeholders}) AND deleted_at IS NULL`).bind(ownerId, ...ids).first<{ count: number }>();
  return Number(row?.count ?? 0) === ids.length;
}
function toPublicContent(row: CodeRow, version: VersionRow, assets: PublicContentResponse["assets"]): PublicContentResponse {
  return { code: { id: row.id, slug: row.slug, title: row.title, contentType: row.content_type as PublicContentResponse["code"]["contentType"], version: version.version, publishedAt: version.published_at, content: jsonParse(version.content_json, { type: "text", title: "", text: "" }), render: jsonParse(version.render_json, defaultRender()) }, assets };
}
async function publicCode(context: AppContext, slug: string): Promise<{ row: CodeRow; version: VersionRow } | null> {
  type Joined = CodeRow & { version_id: string; version_code_id: string; version: number; version_revision: number; content_json: string; render_json: string; version_created_at: string; published_at: string };
  return context.env.DB.prepare("SELECT c.*, v.id AS version_id, v.code_id AS version_code_id, v.version, v.revision AS version_revision, v.content_json, v.render_json, v.created_at AS version_created_at, v.published_at FROM qr_codes c JOIN qr_code_versions v ON v.id = c.published_version_id WHERE c.slug = ? AND c.status = 'active' AND c.deleted_at IS NULL LIMIT 1").bind(slug).first<Joined>().then((joined) => {
    if (!joined) return null;
    const row = joined as CodeRow;
    const version: VersionRow = { id: joined.version_id, code_id: joined.version_code_id, version: joined.version, revision: joined.version_revision, content_json: joined.content_json, render_json: joined.render_json, created_at: joined.version_created_at, published_at: joined.published_at };
    return { row, version };
  });
}

codeRoutes.get("/codes", async (c) => {
  const user = await currentUser(c); if (!user) return apiError(c, 401, "UNAUTHORIZED", "请先登录");
  const rows = await c.env.DB.prepare("SELECT * FROM qr_codes WHERE owner_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200").bind(user.id).all<CodeRow>();
  return c.json({ data: { items: rows.results.map(codePayload), nextCursor: null } });
});

codeRoutes.post("/codes", async (c) => {
  const user = await currentUser(c); if (!user) return apiError(c, 401, "UNAUTHORIZED", "请先登录");
  const parsed = createSchema.safeParse(await readJson(c)); if (!parsed.success) return apiError(c, 422, "VALIDATION_ERROR", "活码参数无效");
  const content = parsed.data.content; const render = renderSchema.parse({ ...defaultRender(), ...(parsed.data.render ?? {}) });
  if (!(await assertOwnedAssets(c, content, render, user.id))) return apiError(c, 422, "UPLOAD_REJECTED", "内容引用了无权限的资源");
  const id = crypto.randomUUID(); const createdAt = nowIso(); let slug = randomSlug(10);
  for (let i = 0; i < 3; i += 1) { const exists = await c.env.DB.prepare("SELECT 1 FROM qr_codes WHERE slug = ?").bind(slug).first(); if (!exists) break; slug = randomSlug(10); }
  await c.env.DB.prepare("INSERT INTO qr_codes (id, owner_id, slug, title, content_type, draft_content_json, draft_render_json, revision, status, published_version_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'active', NULL, ?, ?, NULL)").bind(id, user.id, slug, parsed.data.title, content.type, JSON.stringify(content), JSON.stringify(render), createdAt, createdAt).run();
  const row = await ownedCode(c, id, user.id); if (!row) throw new Error("CODE_CREATE_FAILED");
  return c.json({ data: codePayload(row) }, 201);
});

codeRoutes.get("/codes/:codeId", async (c) => {
  const user = await currentUser(c); if (!user) return apiError(c, 401, "UNAUTHORIZED", "请先登录");
  const id = idSchema.safeParse(c.req.param("codeId")); if (!id.success) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  const row = await ownedCode(c, id.data, user.id); if (!row) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  return c.json({ data: codePayload(row) });
});

codeRoutes.patch("/codes/:codeId", async (c) => {
  const user = await currentUser(c); if (!user) return apiError(c, 401, "UNAUTHORIZED", "请先登录");
  const id = idSchema.safeParse(c.req.param("codeId")); const body = updateSchema.safeParse(await readJson(c)); if (!id.success || !body.success) return apiError(c, 422, "VALIDATION_ERROR", "活码更新参数无效");
  const row = await ownedCode(c, id.data, user.id); if (!row) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  if (row.revision !== body.data.revision) return apiError(c, 409, "REVISION_CONFLICT", "草稿已被其他操作更新");
  const content = body.data.content ?? jsonParse<ActiveContent>(row.draft_content_json, { type: "text", title: "", text: "" });
  const render = renderSchema.parse({ ...defaultRender(), ...jsonParse(row.draft_render_json, {}), ...(body.data.render ?? {}) });
  if (!(await assertOwnedAssets(c, content, render, user.id))) return apiError(c, 422, "UPLOAD_REJECTED", "内容引用了无权限的资源");
  const nextRevision = row.revision + 1; const updatedAt = nowIso();
  await c.env.DB.prepare("UPDATE qr_codes SET title = ?, content_type = ?, draft_content_json = ?, draft_render_json = ?, revision = ?, status = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND revision = ?").bind(body.data.title ?? row.title, content.type, JSON.stringify(content), JSON.stringify(render), nextRevision, body.data.status ?? row.status, updatedAt, row.id, user.id, row.revision).run();
  const updated = await ownedCode(c, row.id, user.id); if (!updated) throw new Error("CODE_UPDATE_FAILED"); return c.json({ data: codePayload(updated) });
});

codeRoutes.delete("/codes/:codeId", async (c) => {
  const user = await currentUser(c); if (!user) return apiError(c, 401, "UNAUTHORIZED", "请先登录");
  const id = idSchema.safeParse(c.req.param("codeId")); if (!id.success) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  const result = await c.env.DB.prepare("UPDATE qr_codes SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(nowIso(), nowIso(), id.data, user.id).run();
  if (!result.meta.changes) return apiError(c, 404, "NOT_FOUND", "活码不存在"); return c.json({ data: { deleted: true } });
});

codeRoutes.post("/codes/:codeId/preview", async (c) => {
  const user = await currentUser(c); if (!user) return apiError(c, 401, "UNAUTHORIZED", "请先登录");
  const id = idSchema.safeParse(c.req.param("codeId")); if (!id.success) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  const row = await ownedCode(c, id.data, user.id); if (!row) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  return c.json({ data: { ...codePayload(row), preview: true, previewToken: await hashValue(`${row.id}:${row.revision}:${Date.now()}`) } });
});

codeRoutes.post("/codes/:codeId/publish", async (c) => {
  const user = await currentUser(c); if (!user) return apiError(c, 401, "UNAUTHORIZED", "请先登录");
  const id = idSchema.safeParse(c.req.param("codeId")); const body = publishSchema.safeParse(await readJson(c)); if (!id.success || !body.success) return apiError(c, 422, "VALIDATION_ERROR", "发布参数无效");
  const row = await ownedCode(c, id.data, user.id); if (!row) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  if (row.revision !== body.data.revision) return apiError(c, 409, "REVISION_CONFLICT", "草稿已被其他操作更新");
  const content = activeContentSchema.parse(jsonParse(row.draft_content_json, null)); const render = renderSchema.parse(jsonParse(row.draft_render_json, defaultRender()));
  if (!(await assertOwnedAssets(c, content, render, user.id))) return apiError(c, 422, "UPLOAD_REJECTED", "内容引用了无权限的资源");
  const previous = await c.env.DB.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM qr_code_versions WHERE code_id = ?").bind(row.id).first<{ version: number }>();
  const version = Number(previous?.version ?? 0) + 1; const versionId = crypto.randomUUID(); const publishedAt = nowIso();
  await c.env.DB.prepare("INSERT INTO qr_code_versions (id, code_id, version, revision, content_json, render_json, created_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(versionId, row.id, version, row.revision, JSON.stringify(content), JSON.stringify(render), publishedAt, publishedAt).run();
  for (const assetId of referencedAssetIds(content, render)) await c.env.DB.prepare("INSERT OR IGNORE INTO qr_code_assets (code_id, version_id, asset_id, role) VALUES (?, ?, ?, 'content')").bind(row.id, versionId, assetId).run();
  await c.env.DB.prepare("UPDATE qr_codes SET published_version_id = ?, status = 'active', updated_at = ? WHERE id = ? AND owner_id = ? AND revision = ?").bind(versionId, publishedAt, row.id, user.id, row.revision).run();
  return c.json({ data: { codeId: row.id, slug: row.slug, version: { id: versionId, version, revision: row.revision, publishedAt } } });
});

codeRoutes.get("/codes/:codeId/versions", async (c) => {
  const user = await currentUser(c); if (!user) return apiError(c, 401, "UNAUTHORIZED", "请先登录");
  const id = idSchema.safeParse(c.req.param("codeId")); if (!id.success) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  if (!(await ownedCode(c, id.data, user.id))) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  const rows = await c.env.DB.prepare("SELECT * FROM qr_code_versions WHERE code_id = ? ORDER BY version DESC").bind(id.data).all<VersionRow>();
  return c.json({ data: { items: rows.results.map((v) => ({ id: v.id, codeId: v.code_id, version: v.version, revision: v.revision, content: jsonParse(v.content_json, null), render: jsonParse(v.render_json, defaultRender()), createdAt: v.created_at, publishedAt: v.published_at })) } });
});

codeRoutes.get("/codes/:codeId/analytics", async (c) => {
  const user = await currentUser(c); if (!user) return apiError(c, 401, "UNAUTHORIZED", "请先登录");
  const id = idSchema.safeParse(c.req.param("codeId")); if (!id.success || !(await ownedCode(c, id.data, user.id))) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  const days = Math.min(90, Math.max(1, Number(c.req.query("days") ?? 30) || 30));
  const rows = await c.env.DB.prepare("SELECT date, scans, views, clicks, downloads, plays FROM analytics_daily_codes WHERE code_id = ? ORDER BY date DESC LIMIT ?").bind(id.data, days).all();
  return c.json({ data: { items: rows.results.reverse(), days } });
});

codeRoutes.post("/codes/:codeId/assets", async (c) => {
  const user = await currentUser(c); if (!user) return apiError(c, 401, "UNAUTHORIZED", "请先登录");
  const id = idSchema.safeParse(c.req.param("codeId")); if (!id.success || !(await ownedCode(c, id.data, user.id))) return apiError(c, 404, "NOT_FOUND", "活码不存在");
  const form = await c.req.formData(); const file = form.get("file"); if (!(file instanceof File)) return apiError(c, 422, "VALIDATION_ERROR", "请选择文件");
  const max = file.type.startsWith("video/") || file.type.startsWith("audio/") ? 50 * 1024 * 1024 : file.type === "application/pdf" ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  const allowed = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm)|audio\/(mpeg|mp4|wav|ogg)|application\/pdf|text\/plain)$/;
  if (!allowed.test(file.type) || file.size > max) return apiError(c, 413, "UPLOAD_REJECTED", "文件类型或大小不符合限制");
  const bytes = await file.arrayBuffer();
  if (!hasExpectedMagic(file.type, bytes)) return apiError(c, 422, "UPLOAD_REJECTED", "文件内容与 MIME 类型不匹配");
  const assetId = crypto.randomUUID(); const objectKey = `codes/${user.id}/${id.data}/${assetId}`; const createdAt = nowIso();
  await c.env.ASSETS_BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: file.type, contentDisposition: `inline; filename="${encodeURIComponent(file.name || assetId)}"` } });
  await c.env.DB.prepare("INSERT INTO assets (id, owner_id, object_key, content_type, size, width, height, purpose, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, 'qr-content', ?, NULL)").bind(assetId, user.id, objectKey, file.type, file.size, createdAt).run();
  return c.json({ data: { id: assetId, contentType: file.type, size: file.size, name: file.name || null } }, 201);
});

publicCodeRoutes.get("/:slug", async (c, next) => {
  const slug = c.req.param("slug"); const ip = c.req.header("CF-Connecting-IP") ?? "local";
  if (!(await consumeRateLimit(c.env.DB, await hashValue(`code:${slug}:${ip}`), 120, 60))) return apiError(c, 429, "RATE_LIMITED", "访问过于频繁，请稍后再试");
  const found = await publicCode(c, slug);
  if (!found) {
    const legacy = await c.env.DB.prepare("SELECT 1 FROM entity_codes WHERE slug = ? AND deleted_at IS NULL LIMIT 1").bind(slug).first();
    if (legacy) return next();
    return apiError(c, 404, "NOT_FOUND", "二维码不存在、已暂停或尚未发布");
  }
  await incrementCodeAnalytics(c, found.row.id, "scans");
  const assets = await publicAssets(c, found.version.id, found.row.slug);
  return c.json({ data: toPublicContent(found.row, found.version, assets) });
});

publicCodeRoutes.get("/:slug/assets/:assetId", async (c) => {
  const found = await publicCode(c, c.req.param("slug")); if (!found) return apiError(c, 404, "NOT_FOUND", "二维码不存在、已暂停或尚未发布");
  const asset = await c.env.DB.prepare("SELECT a.object_key, a.content_type FROM qr_code_assets qa JOIN assets a ON a.id = qa.asset_id WHERE qa.version_id = ? AND qa.asset_id = ? AND a.deleted_at IS NULL LIMIT 1").bind(found.version.id, c.req.param("assetId")).first<{ object_key: string; content_type: string }>();
  if (!asset) return apiError(c, 404, "NOT_FOUND", "资源不存在"); const object = await c.env.ASSETS_BUCKET.get(asset.object_key); if (!object) return apiError(c, 404, "NOT_FOUND", "资源不存在");
  const headers = new Headers({ "Cache-Control": "public, max-age=300", "Content-Type": asset.content_type }); object.writeHttpMetadata(headers); headers.set("ETag", object.httpEtag); return new Response(object.body, { status: 200, headers });
});

publicCodeRoutes.post("/:slug/events", async (c) => {
  const found = await publicCode(c, c.req.param("slug")); if (!found) return apiError(c, 404, "NOT_FOUND", "二维码不存在、已暂停或尚未发布");
  const body = eventSchema.safeParse(await readJson(c)); if (!body.success) return apiError(c, 422, "VALIDATION_ERROR", "事件参数无效");
  const ip = c.req.header("CF-Connecting-IP") ?? "local"; if (!(await consumeRateLimit(c.env.DB, await hashValue(`event:${found.row.id}:${ip}`), 60, 60))) return apiError(c, 429, "RATE_LIMITED", "事件提交过于频繁");
  const occurred = body.data.occurredAt ?? nowIso(); const result = await c.env.DB.prepare("INSERT OR IGNORE INTO qr_access_events (id, code_id, version_id, event, idempotency_key, metadata_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), found.row.id, found.version.id, body.data.event, body.data.idempotencyKey, JSON.stringify(body.data.metadata ?? {}), occurred).run();
  if (result.meta.changes) await incrementCodeAnalytics(c, found.row.id, body.data.event === "scan" ? "scans" : `${body.data.event}s` as "views" | "clicks" | "downloads" | "plays");
  return c.json({ data: { accepted: true, duplicate: !result.meta.changes } });
});

async function publicAssets(c: AppContext, versionId: string, slug: string): Promise<PublicContentResponse["assets"]> {
  const rows = await c.env.DB.prepare("SELECT a.id, a.content_type, a.size, a.object_key FROM qr_code_assets qa JOIN assets a ON a.id = qa.asset_id WHERE qa.version_id = ? AND a.deleted_at IS NULL").bind(versionId).all<{ id: string; content_type: string; size: number; object_key: string }>();
  return rows.results.map((a) => ({ id: a.id, contentType: a.content_type, size: a.size, name: null, url: `/api/public/${slug}/assets/${a.id}` }));
}
async function incrementCodeAnalytics(c: AppContext, codeId: string, field: "scans" | "views" | "clicks" | "downloads" | "plays") {
  const date = new Date().toISOString().slice(0, 10);
  await c.env.DB.prepare(`INSERT INTO analytics_daily_codes (code_id, date, ${field}) VALUES (?, ?, 1) ON CONFLICT(code_id, date) DO UPDATE SET ${field} = ${field} + 1`).bind(codeId, date).run();
}

function hasExpectedMagic(type: string, input: ArrayBuffer): boolean {
  if (type === "text/plain") return true;
  const bytes = new Uint8Array(input).subarray(0, 12);
  const starts = (values: number[]) => values.every((value, index) => bytes[index] === value);
  if (type === "image/png") return starts([0x89, 0x50, 0x4e, 0x47]);
  if (type === "image/jpeg") return starts([0xff, 0xd8, 0xff]);
  if (type === "image/webp") return starts([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (type === "image/gif") return starts([0x47, 0x49, 0x46, 0x38]);
  if (type === "application/pdf") return starts([0x25, 0x50, 0x44, 0x46]);
  if (type === "video/mp4") return bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  if (type === "video/webm") return starts([0x1a, 0x45, 0xdf, 0xa3]);
  if (type.startsWith("audio/")) return true;
  return false;
}
