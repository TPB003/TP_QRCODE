import { describe, expect, it } from "vitest";
import { authUserSchema, requestCodeSchema, verifyCodeSchema } from "@shared/schemas/auth";
import { entityImportSchema, entityRecordSchema, projectContentSchema, visualStyleSchema } from "@shared/schemas/project";
import { formSchema } from "@shared/schemas/form";

describe("shared validation schemas", () => {
  it("accepts a valid URL project and rejects non-http URLs", () => {
    expect(projectContentSchema.parse({ type: "url", value: "https://example.com/你好" }).type).toBe("url");
    expect(projectContentSchema.safeParse({ type: "url", value: "javascript:alert(1)" }).success).toBe(false);
  });

  it("enforces visual style colors and field limits", () => {
    expect(visualStyleSchema.safeParse({ foreground: "#2563EB", background: "#FBF9F3", dotStyle: "rounded", cornerSquareStyle: "dot", cornerDotStyle: "dot", logoAssetId: null, frameText: "" }).success).toBe(true);
    expect(visualStyleSchema.safeParse({ foreground: "blue", background: "#FBF9F3", dotStyle: "rounded", cornerSquareStyle: "dot", cornerDotStyle: "dot", logoAssetId: null, frameText: "" }).success).toBe(false);
  });

  it("accepts Unicode form content and rejects empty required labels", () => {
    const result = formSchema.safeParse({ title: "设备巡检记录", description: "中文说明", coverAssetId: null, fields: [{ id: "11111111-1111-4111-8111-111111111111", type: "shortText", label: "设备名称", required: true }] });
    expect(result.success).toBe(true);
    expect(formSchema.safeParse({ title: "", description: "", fields: [] }).success).toBe(false);
  });

  it("validates batch import boundaries and authentication payloads", () => {
    expect(entityImportSchema.safeParse({ rows: Array.from({ length: 200 }, (_, index) => ({ name: `设备 ${index}` })) }).success).toBe(true);
    expect(entityImportSchema.safeParse({ rows: Array.from({ length: 201 }, (_, index) => ({ name: `设备 ${index}` })) }).success).toBe(false);
    expect(requestCodeSchema.safeParse({ email: "demo@tpqr.local" }).success).toBe(true);
    expect(verifyCodeSchema.safeParse({ email: "demo@tpqr.local", code: "123456" }).success).toBe(true);
    expect(authUserSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111", email: "demo@tpqr.local", createdAt: "2026-01-01T00:00:00.000Z" }).success).toBe(true);
  });

  it("keeps public slugs at ten ASCII characters and caps forms at fifty fields", () => {
    const baseField = { id: "11111111-1111-4111-8111-111111111111", type: "shortText" as const, label: "字段", required: false };
    expect(formSchema.safeParse({ title: "边界表单", description: "", coverAssetId: null, fields: Array.from({ length: 50 }, (_, index) => ({ ...baseField, id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}` })) }).success).toBe(true);
    expect(entityRecordSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111", codeId: "22222222-2222-4222-8222-222222222222", name: "设备", externalId: "EQ-1", fields: {}, slug: "ABC1234567", createdAt: "2026-01-01T00:00:00.000Z" }).success).toBe(true);
    expect(entityRecordSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111", codeId: "22222222-2222-4222-8222-222222222222", name: "设备", externalId: "EQ-1", fields: {}, slug: "too-short", createdAt: "2026-01-01T00:00:00.000Z" }).success).toBe(false);
  });
});
