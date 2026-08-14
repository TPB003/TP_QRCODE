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
  await context.env.ASSETS_BUCKET.delete(asset.object_key);
  await context.env.DB.prepare("UPDATE assets SET deleted_at = ? WHERE id = ? AND owner_id = ?").bind(nowIso(), assetId, user.id).run();
  return context.json({ data: { deleted: true } });
});
