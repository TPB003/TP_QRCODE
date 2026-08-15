import { describe, expect, it } from "vitest";
import { classifyDecodedText } from "@tpqr/qr";

describe("decoder classification", () => {
  it("recognizes TP QR public slugs", () => expect(classifyDecodedText("https://tpqr.example/s/Ab12Cd34Ef")).toMatchObject({ kind: "tpqr", slug: "Ab12Cd34Ef" }));
  it("recognizes safe URLs and rejects dangerous schemes", () => {
    expect(classifyDecodedText("https://example.com/a").kind).toBe("url");
    expect(classifyDecodedText("javascript:alert(1)").kind).toBe("invalid");
  });
  it("recognizes vCard, text, and empty values", () => {
    expect(classifyDecodedText("BEGIN:VCARD\nVERSION:3.0\nEND:VCARD").kind).toBe("vcard");
    expect(classifyDecodedText("你好 TP QR")).toMatchObject({ kind: "text", raw: "你好 TP QR" });
    expect(classifyDecodedText("   ").kind).toBe("invalid");
  });
});
