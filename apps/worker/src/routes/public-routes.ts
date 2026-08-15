import { Hono } from "hono";
import { ALLOWED_IMAGE_TYPES, PRODUCT_LIMITS } from "@shared/constants/product";
import { formSchema, submissionPayloadSchema } from "@shared/schemas/form";
import { projectDraftSchema } from "@shared/schemas/project";
import type { FormSchema, ProjectDraft } from "@shared/types/domain";
import type { Bindings } from "@worker/bindings";
import { apiError, consumeRateLimit, hashValue, jsonParse, nowIso, type AppContext } from "@worker/lib/http";

export const publicRoutes = new Hono<{ Bindings: Bindings }>();

interface PublicRow {
  project_id: string;
  project_name: string;
  project_kind: ProjectDraft["kind"];
  project_status: ProjectDraft["status"];
  entity_id: string;
  code_id: string;
  entity_name: string;
  external_id: string;
  fields_json: string;
  slug: string;
  version_id: string;
  version: number;
  snapshot_json: string;
  published_at: string;
}

async function findPublic(context: AppContext, slug: string): Promise<PublicRow | null> {
  return context.env.DB.prepare(
    "SELECT p.id AS project_id, p.name AS project_name, p.kind AS project_kind, p.status AS project_status, e.id AS entity_id, e.code_id, e.name AS entity_name, e.external_id, e.fields_json, e.slug, v.id AS version_id, v.version, v.snapshot_json, v.published_at FROM entity_codes e JOIN projects p ON p.id = e.project_id JOIN project_versions v ON v.id = p.published_version_id WHERE e.slug = ? AND e.deleted_at IS NULL AND p.deleted_at IS NULL AND p.status = 'active' LIMIT 1",
  )
    .bind(slug)
    .first<PublicRow>();
}

function publicPayload(row: PublicRow) {
  const project = projectDraftSchema.parse(jsonParse(row.snapshot_json, {}));
  return {
    project: {
      id: project.id,
      name: project.name,
      kind: project.kind,
      content: project.content,
      visualStyle: project.visualStyle,
      revision: project.revision,
      publishedVersionId: project.publishedVersionId,
      updatedAt: project.updatedAt,
    },
    version: { id: row.version_id, version: row.version, publishedAt: row.published_at },
    entity: {
      id: row.entity_id,
      codeId: row.code_id,
      name: row.entity_name,
      externalId: row.external_id,
      fields: jsonParse<Record<string, string>>(row.fields_json, {}),
      slug: row.slug,
    },
  };
}

async function incrementAnalytics(context: AppContext, projectId: string, field: "scans" | "submissions") {
  const date = new Date().toISOString().slice(0, 10);
  await context.env.DB.prepare("INSERT INTO analytics_daily (project_id, date, scans, submissions) VALUES (?, ?, ?, ?) ON CONFLICT(project_id, date) DO UPDATE SET " + field + " = " + field + " + 1")
    .bind(projectId, date, field === "scans" ? 1 : 0, field === "submissions" ? 1 : 0)
    .run();
}

async function verifyTurnstile(context: AppContext, token: string | undefined): Promise<boolean> {
  if (context.env.ENVIRONMENT !== "production") return true;
  if (!token || !context.env.TURNSTILE_SECRET_KEY) return false;
  const body = new URLSearchParams({ secret: context.env.TURNSTILE_SECRET_KEY, response: token });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!response.ok) return false;
  const result = await response.json<{ success?: boolean }>();
  return result.success === true;
}

async function allowPublicRequest(context: AppContext, slug: string, limit: number, windowSeconds: number): Promise<boolean> {
  const ip = context.req.header("CF-Connecting-IP") ?? context.req.header("X-Forwarded-For") ?? "local";
  const key = await hashValue(`public:${slug}:${ip}`);
  return consumeRateLimit(context.env.DB, key, limit, windowSeconds);
}

function fieldValue(values: Record<string, unknown>, field: FormSchema["fields"][number]): unknown {
  const byId = values[field.id];
  if (byId !== undefined && byId !== "") return byId;
  return values[field.label];
}

function validateSubmissionValues(
  schema: FormSchema,
  values: Record<string, unknown>,
  files: File[],
): { values: Record<string, unknown>; fieldErrors: Record<string, string[]> } {
  const normalized: Record<string, unknown> = {};
  const fieldErrors: Record<string, string[]> = {};
  const issue = (fieldId: string, message: string) => {
    fieldErrors[fieldId] = [...(fieldErrors[fieldId] ?? []), message];
  };

  for (const field of schema.fields) {
    const value = fieldValue(values, field);
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (empty) {
      if (field.type === "image" && files.length > 0) normalized[field.id] = "uploaded";
      else if (field.required) issue(field.id, "此字段为必填项");
      continue;
    }

    if (field.type === "shortText" && (typeof value !== "string" || value.length > 200)) issue(field.id, "请输入 200 个字符以内的文本");
    if (field.type === "longText" && (typeof value !== "string" || value.length > 4_000)) issue(field.id, "请输入 4000 个字符以内的内容");
    if (field.type === "number" && ((typeof value !== "number" && typeof value !== "string") || value === "" || !Number.isFinite(Number(value)))) issue(field.id, "请输入有效数字");
    if (field.type === "phone" && (typeof value !== "string" || !/^[0-9+\-\s()]{6,25}$/.test(value))) issue(field.id, "请输入有效联系电话");
    if (field.type === "email" && (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) issue(field.id, "请输入有效邮箱");
    if (field.type === "date" && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) issue(field.id, "请输入有效日期");
    if (field.type === "dateTime" && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) issue(field.id, "请输入有效日期时间");
    if (field.type === "singleChoice" && (typeof value !== "string" || (field.options?.length ? !field.options.includes(value) : false))) issue(field.id, "请选择有效选项");
    if (field.type === "multipleChoice" && (!Array.isArray(value) || value.some((item) => typeof item !== "string" || (field.options?.length ? !field.options.includes(item) : false)))) issue(field.id, "请选择有效选项");

    if (field.type === "image") normalized[field.id] = "uploaded";
    else normalized[field.id] = value;
  }

  if (files.length > 5) fieldErrors.files = ["最多上传 5 张图片"];
  return { values: normalized, fieldErrors };
}

publicRoutes.get("/:slug", async (context) => {
  if (!(await allowPublicRequest(context, context.req.param("slug"), 120, 60))) return apiError(context, 429, "RATE_LIMITED", "访问过于频繁，请稍后再试");
  const row = await findPublic(context, context.req.param("slug"));
  if (!row) return apiError(context, 404, "NOT_FOUND", "公共二维码不存在或尚未发布");
  await incrementAnalytics(context, row.project_id, "scans");
  return context.json({ data: publicPayload(row) });
});

publicRoutes.post("/:slug/submissions", async (context) => {
  if (!(await allowPublicRequest(context, context.req.param("slug"), 20, 60))) return apiError(context, 429, "RATE_LIMITED", "提交过于频繁，请稍后再试");
  const row = await findPublic(context, context.req.param("slug"));
  if (!row) return apiError(context, 404, "NOT_FOUND", "公共二维码不存在或尚未发布");
  const project = projectDraftSchema.parse(jsonParse(row.snapshot_json, {}));
  if (project.content.type !== "form" && project.content.type !== "business") return apiError(context, 422, "VALIDATION_ERROR", "当前项目不接收表单提交");
  const schema = formSchema.parse(project.content.schema);
  const contentType = context.req.header("Content-Type") ?? "";
  let values: Record<string, unknown>;
  let turnstileToken: string | undefined;
  const files: File[] = [];
  if (contentType.includes("multipart/form-data")) {
    const form = await context.req.formData();
    const rawValues = form.get("values");
    values = typeof rawValues === "string" ? jsonParse<Record<string, unknown>>(rawValues, {}) : {};
    const rawToken = form.get("turnstileToken");
    turnstileToken = typeof rawToken === "string" ? rawToken : undefined;
    for (const value of form.getAll("files")) if (value instanceof File) files.push(value);
  } else {
    const body = await context.req.json<unknown>().catch(() => null);
    const parsed = submissionPayloadSchema.safeParse(body);
    if (!parsed.success) return apiError(context, 422, "VALIDATION_ERROR", "提交数据无效");
    values = parsed.data.values;
    turnstileToken = parsed.data.turnstileToken;
  }
  if (!(await verifyTurnstile(context, turnstileToken))) return apiError(context, 422, "VALIDATION_ERROR", "请完成人机验证");
  const validated = validateSubmissionValues(schema, values, files);
  if (Object.keys(validated.fieldErrors).some((key) => key !== "files")) return apiError(context, 422, "VALIDATION_ERROR", "请检查表单内容", validated.fieldErrors);
  if (validated.fieldErrors.files) return apiError(context, 422, "UPLOAD_REJECTED", validated.fieldErrors.files[0]);
  for (const file of files) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type) || file.size > PRODUCT_LIMITS.imageBytes) return apiError(context, 413, "UPLOAD_REJECTED", "图片格式或大小不符合要求");
  }

  const submissionId = crypto.randomUUID();
  const createdAt = nowIso();
  const ip = context.req.header("CF-Connecting-IP") ?? context.req.header("X-Forwarded-For") ?? "local";
  const submitterHash = await hashValue(ip);
  await context.env.DB.prepare("INSERT INTO submissions (id, project_id, code_id, version_id, values_json, submitter_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(submissionId, row.project_id, row.code_id, row.version_id, JSON.stringify(validated.values), submitterHash, createdAt)
    .run();
  for (const file of files) {
    const assetId = crypto.randomUUID();
    const objectKey = `submissions/${submissionId}/${assetId}`;
    await context.env.ASSETS_BUCKET.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    await context.env.DB.prepare("INSERT INTO assets (id, owner_id, object_key, content_type, size, width, height, purpose, created_at, deleted_at) VALUES (?, NULL, ?, ?, ?, NULL, NULL, 'submission', ?, NULL)")
      .bind(assetId, objectKey, file.type, file.size, createdAt)
      .run();
    await context.env.DB.prepare("INSERT INTO submission_assets (submission_id, asset_id) VALUES (?, ?)").bind(submissionId, assetId).run();
  }
  await incrementAnalytics(context, row.project_id, "submissions");
  return context.json({ data: { id: submissionId, createdAt } }, 201);
});
