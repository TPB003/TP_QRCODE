import { z } from "zod";
import {
  PROJECT_KINDS,
  PROJECT_STATUSES,
  QR_CORNER_STYLES,
  QR_DOT_STYLES,
} from "@shared/constants/product";
import { formSchema } from "@shared/schemas/form";

export const visualStyleSchema = z.object({
  foreground: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  dotStyle: z.enum(QR_DOT_STYLES),
  cornerSquareStyle: z.enum(QR_CORNER_STYLES),
  cornerDotStyle: z.enum(QR_CORNER_STYLES),
  logoAssetId: z.string().uuid().nullable(),
  frameText: z.string().trim().max(40),
});

export const projectContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), value: z.string().max(4_000) }),
  z.object({ type: z.literal("url"), value: z.string().url().refine((value) => /^https?:\/\//i.test(value)) }),
  z.object({ type: z.literal("image"), assetId: z.string().uuid().nullable() }),
  z.object({ type: z.literal("form"), schema: formSchema }),
  z.object({ type: z.literal("business"), templateKey: z.string().trim().min(1), schema: formSchema }),
]);

export const projectDraftSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(PROJECT_KINDS),
  status: z.enum(PROJECT_STATUSES),
  revision: z.number().int().nonnegative(),
  content: projectContentSchema,
  visualStyle: visualStyleSchema,
  publishedVersionId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createProjectSchema = projectDraftSchema.pick({ name: true, kind: true }).extend({
  templateKey: z.string().trim().min(1).optional(),
});

export const updateProjectSchema = projectDraftSchema
  .pick({ name: true, content: true, visualStyle: true, revision: true })
  .partial({ name: true, content: true, visualStyle: true });

export const entityRecordSchema = z.object({
  id: z.string().uuid(),
  codeId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  externalId: z.string().trim().max(100),
  fields: z.record(z.string(), z.string()),
  slug: z.string().regex(/^[0-9A-Za-z]{10}$/),
  createdAt: z.string().datetime(),
});
