import { describe, expect, it } from "vitest";
import { normalizeHexColor } from "@client/features/qr-editor/hex-color";

describe("normalizeHexColor", () => {
  it("accepts a full hex color with or without a hash and normalizes case", () => {
    expect(normalizeHexColor("#2563eb")).toBe("#2563EB");
    expect(normalizeHexColor("2563eb")).toBe("#2563EB");
    expect(normalizeHexColor("  #abc123 ")).toBe("#ABC123");
  });

  it("rejects empty, partial, short, and non-hex input", () => {
    expect(normalizeHexColor("")).toBeNull();
    expect(normalizeHexColor("#")).toBeNull();
    expect(normalizeHexColor("#11223")).toBeNull();
    expect(normalizeHexColor("#fff")).toBeNull();
    expect(normalizeHexColor("#zzzzzz")).toBeNull();
    expect(normalizeHexColor("蓝色")).toBeNull();
    expect(normalizeHexColor("＃112233")).toBeNull();
  });
});
