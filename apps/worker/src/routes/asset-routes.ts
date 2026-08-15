import { Hono } from "hono";
import { ALLOWED_IMAGE_TYPES, ALLOWED_MEDIA_TYPES, PRODUCT_CONTENT_LIMITS, PRODUCT_LIMITS } from "@shared/constants/product";
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
  if (!(file instanceof File)) return apiError(context, 422, "VALIDATION_ERROR", "请选择文件");
  const maxBytes = purpose === "logo" ? PRODUCT_LIMITS.logoBytes : file.type.startsWith("video/") || file.type.startsWith("audio/") ? PRODUCT_CONTENT_LIMITS.mediaBytes : file.type === "application/pdf" || file.type === "text/plain" ? PRODUCT_CONTENT_LIMITS.fileBytes : PRODUCT_LIMITS.imageBytes;
  if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(file.type)) return apiError(context, 422, "UPLOAD_REJECTED", "不支持的文件类型");
  if (purpose === "logo" && !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return apiError(context, 422, "UPLOAD_REJECTED", "Logo 仅支持图片");
  if (file.size > maxBytes) return apiError(context, 413, "UPLOAD_REJECTED", "文件超过大小限制");
  const bytes = await file.arrayBuffer();
  const id = crypto.randomUUID();
  const objectKey = `users/${user.id}/${id}`;
  await context.env.ASSETS_BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: file.type, contentDisposition: `inline; filename="${encodeURIComponent(file.name || id)}"` } });
  const createdAt = nowIso();
  await context.env.DB.prepare("INSERT INTO assets (id, owner_id, object_key, content_type, size, width, height, purpose, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)")
    .bind(id, user.id, objectKey, file.type, file.size, purpose, createdAt).run();
  return context.json({ data: { id, contentType: file.type, size: file.size, purpose, name: file.name || null } }, 201);
});

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

assetRoutes.get("/public-assets/:assetId", async (context) => {
  const asset = await context.env.DB.prepare(
    `SELECT a.object_key, a.content_type FROM assets a
     JOIN project_versions v ON json_extract(v.snapshot_json, '$.content.type') = 'image' AND json_extract(v.snapshot_json, '$.content.assetId') = a.id
     JOIN projects p ON p.id = v.project_id AND p.published_version_id = v.id
     WHERE a.id = ? AND a.deleted_at IS NULL AND p.deleted_at IS NULL AND p.status = 'active' LIMIT 1`,
  ).bind(context.req.param("assetId")).first<{ object_key: string; content_type: string }>();
  if (!asset) return apiError(context, 404, "NOT_FOUND", "资源不存在");
  const object = await context.env.ASSETS_BUCKET.get(asset.object_key);
  if (!object) return apiError(context, 404, "NOT_FOUND", "资源不存在");
  const headers = new Headers({ "Cache-Control": "public, max-age=300, s-maxage=3600", "Content-Type": asset.content_type }); object.writeHttpMetadata(headers); headers.set("ETag", object.httpEtag);
  return new Response(object.body, { status: 200, headers });
});

assetRoutes.get("/assets/:assetId", async (context) => {
  const user = await currentUser(context); if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const asset = await context.env.DB.prepare("SELECT object_key, content_type FROM assets WHERE id = ? AND owner_id = ? AND deleted_at IS NULL LIMIT 1").bind(context.req.param("assetId"), user.id).first<{ object_key: string; content_type: string }>();
  if (!asset) return apiError(context, 404, "NOT_FOUND", "资源不存在");
  const object = await context.env.ASSETS_BUCKET.get(asset.object_key); if (!object) return apiError(context, 404, "NOT_FOUND", "资源不存在");
  const headers = new Headers({ "Cache-Control": "private, max-age=300", "Content-Type": asset.content_type }); object.writeHttpMetadata(headers); headers.set("ETag", object.httpEtag);
  return new Response(object.body, { status: 200, headers });
});

assetRoutes.delete("/assets/:assetId", async (context) => {
  const user = await currentUser(context); if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  const assetId = context.req.param("assetId");
  const asset = await context.env.DB.prepare("SELECT object_key FROM assets WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(assetId, user.id).first<{ object_key: string }>();
  if (!asset) return apiError(context, 404, "NOT_FOUND", "资源不存在");
  const inUse = await context.env.DB.prepare("SELECT 1 FROM qr_code_assets WHERE asset_id = ? LIMIT 1").bind(assetId).first() ?? await context.env.DB.prepare("SELECT 1 FROM projects p LEFT JOIN project_versions v ON v.id = p.published_version_id WHERE p.deleted_at IS NULL AND (json_extract(p.draft_content_json, '$.assetId') = ? OR json_extract(p.draft_content_json, '$.schema.coverAssetId') = ? OR json_extract(p.visual_style_json, '$.logoAssetId') = ? OR json_extract(v.snapshot_json, '$.content.assetId') = ? OR json_extract(v.snapshot_json, '$.visualStyle.logoAssetId') = ?) LIMIT 1").bind(assetId, assetId, assetId, assetId, assetId).first();
  if (inUse) return apiError(context, 409, "ASSET_IN_USE", "资源正在被活码使用");
  await context.env.ASSETS_BUCKET.delete(asset.object_key);
  await context.env.DB.prepare("UPDATE assets SET deleted_at = ? WHERE id = ? AND owner_id = ?").bind(nowIso(), assetId, user.id).run();
  return context.json({ data: { deleted: true } });
});
