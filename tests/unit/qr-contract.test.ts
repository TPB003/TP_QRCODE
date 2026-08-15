import { describe, expect, it } from "vitest";
import { classifyDecodedText, createQrMetadata, getQrCanvasBox, qrFileName, validateActiveContent } from "@tpqr/qr";
import { generateSlug, incrementRevision, isValidSlug } from "@tpqr/domain";

describe("QR contracts", () => {
  it("generates deterministic slug shape and revisions", () => {
    const slug = generateSlug(10, () => 0);
    expect(slug).toBe("0000000000");
    expect(isValidSlug(slug)).toBe(true);
    expect(incrementRevision(2)).toBe(3);
  });
  it("creates public payload metadata", () => {
    const metadata = createQrMetadata({
      codeId: "code-1", slug: "Abc1234567", origin: "https://qr.example.com/",
      content: { type: "text", title: "", text: "hello" }, render: { size: 99_999, margin: 20 },
    });
    expect(metadata.payload).toBe("https://qr.example.com/s/Abc1234567");
    expect(metadata.render.size).toBe(2048);
    expect(getQrCanvasBox(400, 20).innerSize).toBe(360);
    expect(qrFileName(metadata.slug, "png")).toBe("tp-qr-Abc1234567.png");
  });
  it("classifies TP QR, URL, vCard, text and invalid payloads", () => {
    expect(classifyDecodedText("https://qr.example.com/s/Abc1234567").kind).toBe("tpqr");
    expect(classifyDecodedText("https://example.com").kind).toBe("url");
    expect(classifyDecodedText("BEGIN:VCARD\nVERSION:3.0\nEND:VCARD").kind).toBe("vcard");
    expect(classifyDecodedText("普通文字").kind).toBe("text");
    expect(classifyDecodedText("javascript:alert(1)").kind).toBe("invalid");
  });
  it("validates content without coupling to a renderer", () => {
    expect(validateActiveContent({ type: "text", text: "ok" }).success).toBe(true);
    expect(validateActiveContent({ type: "url", url: "javascript:bad" }).success).toBe(false);
    expect(validateActiveContent({ type: "text", text: 123 }).success).toBe(false);
  });
});
