import type { ActiveContent, QrCodeMetadata, QrRenderConfig } from "@tpqr/domain";
import { normalizeQrSize } from "./validation";

export const DEFAULT_QR_RENDER_CONFIG: QrRenderConfig = {
  size: 320,
  margin: 16,
  foreground: "#111111",
  background: "#ffffff",
  dotStyle: "rounded",
  cornerSquareStyle: "extra-rounded",
  cornerDotStyle: "dot",
  logoAssetId: null,
  logoSize: 56,
  frameText: "",
  showFrame: false,
  errorCorrectionLevel: "M",
};

export function buildPublicPayload(slug: string, origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/s/${encodeURIComponent(slug)}`;
}

export function createQrMetadata(input: {
  codeId: string; slug: string; content: ActiveContent; origin?: string; render?: Partial<QrRenderConfig>;
}): QrCodeMetadata {
  return {
    codeId: input.codeId,
    slug: input.slug,
    contentType: input.content.type,
    payload: buildPublicPayload(input.slug, input.origin),
    render: { ...DEFAULT_QR_RENDER_CONFIG, ...input.render, size: normalizeQrSize(input.render?.size ?? DEFAULT_QR_RENDER_CONFIG.size) },
  };
}

/** Keeps the QR matrix and paper backing square and aligned, avoiding a clipped white border. */
export function getQrCanvasBox(size: number, margin: number): { size: number; innerSize: number; margin: number } {
  const normalizedSize = normalizeQrSize(size);
  const safeMargin = Math.max(0, Math.min(Math.floor(normalizedSize / 4), Math.round(margin)));
  return { size: normalizedSize, margin: safeMargin, innerSize: normalizedSize - safeMargin * 2 };
}
