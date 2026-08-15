import type { z } from "zod";
import type { activeContentSchema } from "@shared/schemas/active-content";
import type { QrCodeVersion, QrRenderConfig } from "@shared/contracts/qr";

export type ActiveContent = z.infer<typeof activeContentSchema>;
export type { QrCodeVersion, QrRenderConfig };

export interface QrCode {
  id: string;
  ownerId: string;
  slug: string;
  title: string;
  contentType: ActiveContent["type"];
  status: "draft" | "published" | "paused" | "deleted";
  revision: number;
  content: ActiveContent;
  render: QrRenderConfig;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}
