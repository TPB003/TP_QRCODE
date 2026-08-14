import { Hono } from "hono";
import { ALLOWED_IMAGE_TYPES, PRODUCT_LIMITS } from "@shared/constants/product";
import type { Bindings } from "@worker/bindings";
import { currentUser } from "@worker/lib/auth";
import { apiError, nowIso } from "@worker/lib/http";

export const assetRoutes = new Hono<{ Bindings: Bindings }>();

assetRoutes.post("/assets", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const form = await context.req.formData();
  const file = form.get("file");
  const rawPurpose = form.get("purpose");
  const purpose = typeof rawPurpose === "string" ? rawPurpose : "upload";
  if (!(file instanceof File)) return apiError(context, 422, "VALIDATION_ERROR", "请选择图片文件");
  const maxBytes = purpose === "logo" ? PRODUCT_LIMITS.logoBytes : PRODUCT_LIMITS.imageBytes;
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return apiError(context, 422, "UPLOAD_REJECTED", "仅支持 JPEG、PNG 或 WebP 图片");
  if (file.size > maxBytes) return apiError(context, 413, "UPLOAD_REJECTED", "图片超过大小限制");
  const id = crypto.randomUUID();
  const objectKey = `users/${user.id}/${id}`;
  const bytes = await file.arrayBuffer();
  await context.env.ASSETS_BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: file.type } });
  const createdAt = nowIso();
  await context.env.DB.prepare("INSERT INTO assets (id, owner_id, object_key, content_type, size, width, height, purpose, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)")
    .bind(id, user.id, objectKey, file.type, file.size, purpose, createdAt)
    .run();
  return context.json({ data: { id, contentType: file.type, size: file.size, purpose } }, 201);
});

assetRoutes.get("/public-assets/:assetId", async (context) => {
  const asset = await context.env.DB.prepare(
    `SELECT a.object_key, a.content_type
     FROM assets a
     JOIN project_versions v
       ON json_extract(v.snapshot_json, '$.content.type') = 'image'
      AND json_extract(v.snapshot_json, '$.content.assetId') = a.id
     JOIN projects p
       ON p.id = v.project_id
      AND p.published_version_id = v.id
     WHERE a.id = ?
       AND a.deleted_at IS NULL
       AND p.deleted_at IS NULL
       AND p.status = 'active'
     LIMIT 1`,
  ).bind(context.req.param("assetId")).first<{ object_key: string; content_type: string }>();
  if (!asset) return apiError(context, 404, "NOT_FOUND", "璧勬簮涓嶅瓨鍦ㄦ垨灏氭湭鍙戝竷");
  const object = await context.env.ASSETS_BUCKET.get(asset.object_key);
  if (!object) return apiError(context, 404, "NOT_FOUND", "璧勬簮涓嶅瓨鍦ㄦ垨灏氭湭鍙戝竷");
  const headers = new Headers({ "Cache-Control": "public, max-age=300, s-maxage=3600", "Content-Type": asset.content_type });
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=300, s-maxage=3600");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { status: 200, headers });
});

assetRoutes.get("/assets/:assetId", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const asset = await context.env.DB.prepare("SELECT object_key, content_type FROM assets WHERE id = ? AND owner_id = ? AND deleted_at IS NULL LIMIT 1")
    .bind(context.req.param("assetId"), user.id)
    .first<{ object_key: string; content_type: string }>();
  if (!asset) return apiError(context, 404, "NOT_FOUND", "资源不存在");
  const object = await context.env.ASSETS_BUCKET.get(asset.object_key);
  if (!object) return apiError(context, 404, "NOT_FOUND", "资源不存在");
  const headers = new Headers({ "Cache-Control": "private, max-age=300", "Content-Type": asset.content_type });
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { status: 200, headers });
});

assetRoutes.delete("/assets/:assetId", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const assetId = context.req.param("assetId");
  const asset = await context.env.DB.prepare("SELECT object_key FROM assets WHERE id = ? AND owner_id = ? AND deleted_at IS NULL")
    .bind(assetId, user.id)
    .first<{ object_key: string }>();
  if (!asset) return apiError(context, 404, "NOT_FOUND", "资源不存在");
  const inUse = await context.env.DB.prepare(
    `SELECT 1
     FROM projects p
     LEFT JOIN project_versions v ON v.id = p.published_version_id
     WHERE p.owner_id = ?
       AND p.deleted_at IS NULL
       AND (
         json_extract(p.draft_content_json, '$.assetId') = ?
         OR json_extract(p.draft_content_json, '$.schema.coverAssetId') = ?
         OR json_extract(p.visual_style_json, '$.logoAssetId') = ?
         OR json_extract(v.snapshot_json, '$.content.assetId') = ?
         OR json_extract(v.snapshot_json, '$.content.schema.coverAssetId') = ?
         OR json_extract(v.snapshot_json, '$.visualStyle.logoAssetId') = ?
       )
     LIMIT 1`,
  ).bind(user.id, assetId, assetId, assetId, assetId, assetId, assetId).first();
  if (inUse) return apiError(context, 409, "ASSET_IN_USE", "璧勬簮姝ｅ湪琚」鐩娇鐢ㄤ腑");
  await context.env.ASSETS_BUCKET.delete(asset.object_key);
  await context.env.DB.prepare("UPDATE assets SET deleted_at = ? WHERE id = ? AND owner_id = ?").bind(nowIso(), assetId, user.id).run();
  return context.json({ data: { deleted: true } });
});
