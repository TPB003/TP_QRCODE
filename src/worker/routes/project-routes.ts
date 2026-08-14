import { Hono } from "hono";
import { z } from "zod";
import { createProjectSchema, entityImportSchema, projectListQuerySchema, publishProjectSchema, updateProjectSchema } from "@shared/schemas/project";
import type { ProjectDraft } from "@shared/types/domain";
import type { Bindings } from "@worker/bindings";
import { currentUser } from "@worker/lib/auth";
import { defaultVisualStyle, rowToEntity, rowToProject, type EntityRow, type ProjectRow } from "@worker/lib/db";
import { apiError, escapeCsv, jsonParse, nowIso, randomSlug, readJson } from "@worker/lib/http";
import { templateList, templateSchema } from "@worker/lib/templates";

export const projectRoutes = new Hono<{ Bindings: Bindings }>();

const projectIdParamSchema = z.object({ projectId: z.string().uuid() });
const submissionParamSchema = z.object({ projectId: z.string().uuid(), submissionId: z.string().uuid() });
const submissionAssetParamSchema = submissionParamSchema.extend({ assetId: z.string().uuid() });

function contentFor(kind: ProjectDraft["kind"], templateKey?: "checkin" | "personnel" | "inspection" | "collection") {
  if (kind === "text") return { type: "text" as const, value: "" };
  if (kind === "url") return { type: "url" as const, value: "https://example.com" };
  if (kind === "image") return { type: "image" as const, assetId: null };
  const key = templateKey ?? "inspection";
  const schema = templateSchema(key);
  return kind === "business" ? { type: "business" as const, templateKey: key, schema } : { type: "form" as const, schema };
}

async function getProject(context: Parameters<typeof currentUser>[0], projectId: string, ownerId?: string): Promise<ProjectRow | null> {
  const ownerClause = ownerId ? " AND owner_id = ?" : "";
  const statement = context.env.DB.prepare(`SELECT id, owner_id, name, kind, status, revision, draft_content_json, visual_style_json, published_version_id, created_at, updated_at, deleted_at FROM projects WHERE id = ? AND deleted_at IS NULL${ownerClause} LIMIT 1`);
  const row = ownerId ? await statement.bind(projectId, ownerId).first<ProjectRow>() : await statement.bind(projectId).first<ProjectRow>();
  return row;
}

function referencedAssetIds(project: ProjectDraft): string[] {
  const ids = [project.visualStyle.logoAssetId];
  if (project.content.type === "image") ids.push(project.content.assetId);
  if (project.content.type === "form" || project.content.type === "business") ids.push(project.content.schema.coverAssetId);
  return ids.filter((id): id is string => Boolean(id));
}

async function hasOnlyOwnedAssets(context: Parameters<typeof currentUser>[0], project: ProjectDraft, ownerId: string): Promise<boolean> {
  const ids = referencedAssetIds(project);
  if (ids.length === 0) return true;
  const placeholders = ids.map(() => "?").join(",");
  const row = await context.env.DB.prepare(`SELECT COUNT(*) AS count FROM assets WHERE owner_id = ? AND deleted_at IS NULL AND id IN (${placeholders})`)
    .bind(ownerId, ...ids)
    .first<{ count: number }>();
  return Number(row?.count ?? 0) === ids.length;
}

async function createEntity(db: D1Database, projectId: string, name: string, externalId = "", fields: Record<string, string> = {}) {
  const id = crypto.randomUUID();
  const codeId = crypto.randomUUID();
  const slug = randomSlug();
  const createdAt = nowIso();
  await db.prepare("INSERT INTO entity_codes (id, project_id, code_id, name, external_id, fields_json, slug, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, projectId, codeId, name, externalId, JSON.stringify(fields), slug, createdAt)
    .run();
  return { id, codeId, name, externalId, fields, slug, createdAt };
}

projectRoutes.get("/templates", (context) => context.json({ data: templateList() }));

projectRoutes.get("/projects", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const query = projectListQuerySchema.safeParse({
    q: context.req.query("q"),
    status: context.req.query("status"),
  });
  if (!query.success) return apiError(context, 422, "VALIDATION_ERROR", "筛选条件无效");
  const clauses = ["owner_id = ?", "deleted_at IS NULL"];
  const values: string[] = [user.id];
  if (query.data.q) {
    clauses.push("name LIKE ?");
    values.push(`%${query.data.q}%`);
  }
  if (query.data.status) {
    clauses.push("status = ?");
    values.push(query.data.status);
  }
  const rows = await context.env.DB.prepare(`SELECT id, owner_id, name, kind, status, revision, draft_content_json, visual_style_json, published_version_id, created_at, updated_at, deleted_at FROM projects WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC`).bind(...values).all<ProjectRow>();
  return context.json({ data: { items: rows.results.map(rowToProject), nextCursor: null } });
});

projectRoutes.post("/projects", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const body = await readJson<unknown>(context);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) return apiError(context, 422, "VALIDATION_ERROR", "项目参数无效");
  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const content = contentFor(parsed.data.kind, parsed.data.templateKey);
  const style = defaultVisualStyle();
  const kindLabel = parsed.data.name.trim();
  await context.env.DB.prepare("INSERT INTO projects (id, owner_id, name, kind, status, revision, draft_content_json, visual_style_json, published_version_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?, NULL)")
    .bind(id, user.id, kindLabel, parsed.data.kind, "active", JSON.stringify(content), JSON.stringify(style), timestamp, timestamp)
    .run();
  const entity = await createEntity(context.env.DB, id, kindLabel);
  const row = await getProject(context, id, user.id);
  if (!row) throw new Error("PROJECT_CREATE_FAILED");
  return context.json({ data: { project: rowToProject(row), entity } }, 201);
});

projectRoutes.get("/projects/:projectId", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = projectIdParamSchema.safeParse(context.req.param());
  if (!params.success) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  const row = await getProject(context, params.data.projectId, user.id);
  if (!row) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  const entities = await context.env.DB.prepare("SELECT id, project_id, code_id, name, external_id, fields_json, slug, created_at, deleted_at FROM entity_codes WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC")
    .bind(row.id)
    .all<EntityRow>();
  return context.json({ data: { project: rowToProject(row), entities: entities.results.map(rowToEntity) } });
});

projectRoutes.patch("/projects/:projectId", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = projectIdParamSchema.safeParse(context.req.param());
  const body = await readJson<unknown>(context);
  const parsed = updateProjectSchema.safeParse(body);
  if (!params.success || !parsed.success || parsed.data.revision === undefined) return apiError(context, 422, "VALIDATION_ERROR", "项目更新参数无效");
  const row = await getProject(context, params.data.projectId, user.id);
  if (!row) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  if (row.revision !== parsed.data.revision) return apiError(context, 409, "REVISION_CONFLICT", "项目已被其他修改更新");
  const current = rowToProject(row);
  const next = {
    ...current,
    name: parsed.data.name ?? current.name,
    content: parsed.data.content ?? current.content,
    visualStyle: parsed.data.visualStyle ?? current.visualStyle,
    status: parsed.data.status ?? current.status,
    revision: current.revision + 1,
    updatedAt: nowIso(),
  } satisfies ProjectDraft;
  const validated = (await import("@shared/schemas/project")).projectDraftSchema.parse(next);
  if (!(await hasOnlyOwnedAssets(context, validated, user.id))) return apiError(context, 422, "VALIDATION_ERROR", "项目引用了无权限访问的资源");
  await context.env.DB.prepare("UPDATE projects SET name = ?, status = ?, revision = ?, draft_content_json = ?, visual_style_json = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND revision = ?")
    .bind(validated.name, validated.status, validated.revision, JSON.stringify(validated.content), JSON.stringify(validated.visualStyle), validated.updatedAt, row.id, user.id, row.revision)
    .run();
  const updatedRow = await getProject(context, row.id, user.id);
  if (!updatedRow) throw new Error("PROJECT_UPDATE_FAILED");
  return context.json({ data: rowToProject(updatedRow) });
});

projectRoutes.post("/projects/:projectId/publish", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = projectIdParamSchema.safeParse(context.req.param());
  const body = await readJson<unknown>(context);
  const parsedBody = publishProjectSchema.safeParse(body);
  if (!params.success || !parsedBody.success) return apiError(context, 422, "VALIDATION_ERROR", "发布参数无效");
  const row = await getProject(context, params.data.projectId, user.id);
  if (!row) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  if (row.revision !== parsedBody.data.revision) return apiError(context, 409, "REVISION_CONFLICT", "项目已被其他修改更新");
  const project = rowToProject(row);
  const previous = await context.env.DB.prepare("SELECT MAX(version) AS version FROM project_versions WHERE project_id = ?").bind(row.id).first<{ version: number | null }>();
  const version = (previous?.version ?? 0) + 1;
  const versionId = crypto.randomUUID();
  const publishedAt = nowIso();
  const snapshot = { ...project, publishedVersionId: versionId } satisfies ProjectDraft;
  await context.env.DB.prepare("INSERT INTO project_versions (id, project_id, version, snapshot_json, published_at) VALUES (?, ?, ?, ?, ?)")
    .bind(versionId, row.id, version, JSON.stringify(snapshot), publishedAt)
    .run();
  await context.env.DB.prepare("UPDATE projects SET published_version_id = ?, status = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
    .bind(versionId, "active", publishedAt, row.id, user.id)
    .run();
  return context.json({ data: { project: { ...project, publishedVersionId: versionId }, version: { id: versionId, version, publishedAt } } });
});

projectRoutes.delete("/projects/:projectId", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = projectIdParamSchema.safeParse(context.req.param());
  if (!params.success) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  const result = await context.env.DB.prepare("UPDATE projects SET status = ?, deleted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL")
    .bind("deleted", nowIso(), nowIso(), params.data.projectId, user.id)
    .run();
  if (!result.meta.changes) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  return context.json({ data: { deleted: true } });
});

projectRoutes.get("/projects/:projectId/entities", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = projectIdParamSchema.safeParse(context.req.param());
  if (!params.success || !(await getProject(context, params.data.projectId, user.id))) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  const rows = await context.env.DB.prepare("SELECT id, project_id, code_id, name, external_id, fields_json, slug, created_at, deleted_at FROM entity_codes WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC")
    .bind(params.data.projectId)
    .all<EntityRow>();
  return context.json({ data: { items: rows.results.map(rowToEntity), nextCursor: null } });
});

projectRoutes.post("/projects/:projectId/entities/import", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = projectIdParamSchema.safeParse(context.req.param());
  const body = await readJson<unknown>(context);
  const parsed = entityImportSchema.safeParse(body);
  if (!params.success || !parsed.success) return apiError(context, 422, "VALIDATION_ERROR", "实体导入参数无效");
  if (!(await getProject(context, params.data.projectId, user.id))) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  const created = [];
  for (const row of parsed.data.rows) created.push(await createEntity(context.env.DB, params.data.projectId, row.name, row.externalId, row.fields));
  return context.json({ data: { items: created, count: created.length } }, 201);
});

interface SubmissionRow {
  id: string;
  code_id: string;
  version_id: string;
  values_json: string;
  created_at: string;
  attachment_count: number;
}

interface SubmissionDetailRow {
  id: string;
  code_id: string;
  version_id: string;
  values_json: string;
  created_at: string;
}

interface SubmissionAssetRow {
  id: string;
  content_type: string;
  size: number;
}

projectRoutes.get("/projects/:projectId/submissions", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = projectIdParamSchema.safeParse(context.req.param());
  if (!params.success || !(await getProject(context, params.data.projectId, user.id))) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  const rows = await context.env.DB.prepare("SELECT s.id, s.code_id, s.version_id, s.values_json, s.created_at, COUNT(sa.asset_id) AS attachment_count FROM submissions s LEFT JOIN submission_assets sa ON sa.submission_id = s.id WHERE s.project_id = ? GROUP BY s.id ORDER BY s.created_at DESC LIMIT 200")
    .bind(params.data.projectId)
    .all<SubmissionRow>();
  return context.json({ data: { items: rows.results.map((row) => ({ id: row.id, codeId: row.code_id, versionId: row.version_id, values: jsonParse(row.values_json, {}), attachments: row.attachment_count, createdAt: row.created_at })), nextCursor: null } });
});

projectRoutes.get("/projects/:projectId/submissions/:submissionId", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = submissionParamSchema.safeParse(context.req.param());
  if (!params.success || !(await getProject(context, params.data.projectId, user.id))) return apiError(context, 404, "NOT_FOUND", "提交记录不存在");
  const submission = await context.env.DB.prepare("SELECT id, code_id, version_id, values_json, created_at FROM submissions WHERE id = ? AND project_id = ? LIMIT 1")
    .bind(params.data.submissionId, params.data.projectId)
    .first<SubmissionDetailRow>();
  if (!submission) return apiError(context, 404, "NOT_FOUND", "提交记录不存在");
  const assets = await context.env.DB.prepare("SELECT a.id, a.content_type, a.size FROM assets a JOIN submission_assets sa ON sa.asset_id = a.id WHERE sa.submission_id = ? AND a.deleted_at IS NULL ORDER BY a.created_at ASC")
    .bind(submission.id)
    .all<SubmissionAssetRow>();
  return context.json({ data: {
    id: submission.id,
    codeId: submission.code_id,
    versionId: submission.version_id,
    values: jsonParse<Record<string, unknown>>(submission.values_json, {}),
    createdAt: submission.created_at,
    attachments: assets.results.map((asset) => ({ id: asset.id, contentType: asset.content_type, size: asset.size, url: `/api/projects/${params.data.projectId}/submissions/${submission.id}/assets/${asset.id}` })),
  } });
});

projectRoutes.get("/projects/:projectId/submissions/:submissionId/assets/:assetId", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = submissionAssetParamSchema.safeParse(context.req.param());
  if (!params.success || !(await getProject(context, params.data.projectId, user.id))) return apiError(context, 404, "NOT_FOUND", "附件不存在");
  const asset = await context.env.DB.prepare("SELECT a.object_key FROM assets a JOIN submission_assets sa ON sa.asset_id = a.id JOIN submissions s ON s.id = sa.submission_id WHERE a.id = ? AND s.id = ? AND s.project_id = ? AND a.deleted_at IS NULL LIMIT 1")
    .bind(params.data.assetId, params.data.submissionId, params.data.projectId)
    .first<{ object_key: string }>();
  if (!asset) return apiError(context, 404, "NOT_FOUND", "附件不存在");
  const object = await context.env.ASSETS_BUCKET.get(asset.object_key);
  if (!object) return apiError(context, 404, "NOT_FOUND", "附件不存在");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { status: 200, headers });
});

projectRoutes.get("/projects/:projectId/submissions/export", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = projectIdParamSchema.safeParse(context.req.param());
  if (!params.success || !(await getProject(context, params.data.projectId, user.id))) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  const rows = await context.env.DB.prepare("SELECT id, code_id, values_json, created_at FROM submissions WHERE project_id = ? ORDER BY created_at DESC LIMIT 2000")
    .bind(params.data.projectId)
    .all<SubmissionRow>();
  const csv = ["submission_id,code_id,created_at,values", ...rows.results.map((row) => `${escapeCsv(row.id)},${escapeCsv(row.code_id)},${escapeCsv(row.created_at)},${escapeCsv(row.values_json)}`)].join("\n");
  context.header("Content-Type", "text/csv; charset=utf-8");
  context.header("Content-Disposition", "attachment; filename=tp-qr-submissions.csv");
  return context.body(`\uFEFF${csv}`);
});

projectRoutes.get("/projects/:projectId/analytics", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const params = projectIdParamSchema.safeParse(context.req.param());
  const rawDays = Number(context.req.query("days") ?? 30);
  if (!Number.isInteger(rawDays) || rawDays < 1) return apiError(context, 422, "VALIDATION_ERROR", "统计天数必须是正整数");
  const days = Math.min(30, rawDays);
  if (!params.success || !(await getProject(context, params.data.projectId, user.id))) return apiError(context, 404, "NOT_FOUND", "项目不存在");
  const rows = await context.env.DB.prepare("SELECT date, scans, submissions FROM analytics_daily WHERE project_id = ? ORDER BY date DESC LIMIT ?")
    .bind(params.data.projectId, days)
    .all<{ date: string; scans: number; submissions: number }>();
  return context.json({ data: { items: rows.results.reverse(), days } });
});
