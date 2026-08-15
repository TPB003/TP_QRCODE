import { describe, expect, it } from "vitest";
import { activeContentSchema } from "@tpqr/domain";
import { isSafeUrl, parseVCard, toVCard, validateFile } from "@tpqr/content";

describe("active content contract", () => {
  it("accepts all seven active content types", () => {
    const values = [
      { type: "image", assetId: "00000000-0000-4000-8000-000000000001" },
      { type: "video", assetId: "00000000-0000-4000-8000-000000000001" },
      { type: "audio", assetId: "00000000-0000-4000-8000-000000000001" },
      { type: "file", assetId: "00000000-0000-4000-8000-000000000001", downloadName: "guide.pdf" },
      { type: "url", url: "https://example.com" },
      { type: "contact", firstName: "小明", email: "xiaoming@example.com" },
      { type: "text", text: "你好，TP QR" },
    ];
    for (const value of values) expect(activeContentSchema.safeParse(value).success).toBe(true);
  });
  it("rejects dangerous URLs", () => {
    expect(isSafeUrl("https://example.com/a?q=1")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,hello")).toBe(false);
    expect(isSafeUrl("https://user:pass@example.com")).toBe(false);
  });
  it("round trips a unicode vCard", () => {
    const card = toVCard({ firstName: "小明", lastName: "张", phone: "+86 138", email: "m@example.com", note: "第一行\n第二行" });
    const parsed = parseVCard(card);
    expect(parsed.firstName).toBe("小明");
    expect(parsed.lastName).toBe("张");
    expect(parsed.phone).toBe("+86 138");
    expect(parsed.note).toContain("第一行");
  });
});

describe("file validation", () => {
  it("checks MIME, extension, size and magic bytes", () => {
    const png = { name: "photo.png", type: "image/png", size: 4_096 };
    expect(validateFile(png, Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({ ok: true });
    expect(validateFile({ ...png, name: "photo.exe" })).toMatchObject({ ok: false, reason: "EXTENSION" });
    expect(validateFile({ ...png, type: "application/octet-stream" })).toMatchObject({ ok: false, reason: "MIME" });
    expect(validateFile(png, Uint8Array.from([0x00, 0x00]))).toMatchObject({ ok: false, reason: "MAGIC" });
  });
});
