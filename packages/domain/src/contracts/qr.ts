import type { ActiveContent } from "@shared/schemas/active-content";
import type { ActiveContentType } from "@shared/constants/product";

export type QrOutputFormat = "png" | "svg" | "webp" | "jpg";
export type QrDotStyle = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
export type QrCornerStyle = "square" | "dot" | "extra-rounded";

export interface QrRenderConfig {
  size: number;
  margin: number;
  foreground: string;
  background: string;
  dotStyle: QrDotStyle;
  cornerSquareStyle: QrCornerStyle;
  cornerDotStyle: QrCornerStyle;
  logoAssetId?: string | null;
  logoSize?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

export interface QrCodeMetadata {
  codeId: string;
  slug: string;
  contentType: ActiveContentType;
  payload: string;
  render: QrRenderConfig;
}

export interface PublicContentResponse {
  code: {
    id: string;
    slug: string;
    title: string;
    contentType: ActiveContentType;
    version: number;
    publishedAt: string;
    content: ActiveContent;
    render: QrRenderConfig;
  };
  assets: Array<{
    id: string;
    contentType: string;
    size: number;
    name: string | null;
    url: string;
  }>;
}

export type PublicEventType = "scan" | "view" | "click" | "download" | "play";
export interface PublicAccessEvent {
  idempotencyKey: string;
  event: PublicEventType;
  occurredAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface QrCodeVersion {
  id: string;
  codeId: string;
  version: number;
  revision: number;
  content: ActiveContent;
  render: QrRenderConfig;
  createdAt: string;
  publishedAt: string | null;
}
