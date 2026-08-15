import { z } from "zod";
import { ACTIVE_CONTENT_TYPES, PRODUCT_CONTENT_LIMITS } from "@shared/constants/product";

const assetId = z.string().uuid();

export const imageContentSchema = z.object({
  type: z.literal("image"),
  assetId,
  alt: z.string().trim().max(240).default(""),
  title: z.string().trim().max(PRODUCT_CONTENT_LIMITS.titleCharacters).default(""),
});

export const videoContentSchema = z.object({
  type: z.literal("video"),
  assetId,
  title: z.string().trim().max(PRODUCT_CONTENT_LIMITS.titleCharacters).default(""),
  posterAssetId: assetId.nullable().default(null),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
});

export const audioContentSchema = z.object({
  type: z.literal("audio"),
  assetId,
  title: z.string().trim().max(PRODUCT_CONTENT_LIMITS.titleCharacters).default(""),
  artist: z.string().trim().max(120).default(""),
  coverAssetId: assetId.nullable().default(null),
});

export const fileContentSchema = z.object({
  type: z.literal("file"),
  assetId,
  title: z.string().trim().max(PRODUCT_CONTENT_LIMITS.titleCharacters).default(""),
  description: z.string().trim().max(500).default(""),
  downloadName: z.string().trim().min(1).max(180).regex(/^[^\\/:*?"<>|]+$/),
});

export const urlContentSchema = z.object({
  type: z.literal("url"),
  url: z.string().trim().min(1).max(PRODUCT_CONTENT_LIMITS.urlCharacters),
  title: z.string().trim().max(PRODUCT_CONTENT_LIMITS.titleCharacters).default(""),
  description: z.string().trim().max(500).default(""),
});

export const contactContentSchema = z.object({
  type: z.literal("contact"),
  firstName: z.string().trim().max(80).default(""),
  lastName: z.string().trim().max(80).default(""),
  organization: z.string().trim().max(160).default(""),
  title: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().email().or(z.literal("")).default(""),
  website: z.string().trim().max(PRODUCT_CONTENT_LIMITS.urlCharacters).or(z.literal("")).default(""),
  address: z.string().trim().max(300).default(""),
  note: z.string().trim().max(500).default(""),
});

export const textContentSchema = z.object({
  type: z.literal("text"),
  title: z.string().trim().max(PRODUCT_CONTENT_LIMITS.titleCharacters).default(""),
  text: z.string().max(PRODUCT_CONTENT_LIMITS.textCharacters),
});

export const activeContentSchema = z.discriminatedUnion("type", [
  imageContentSchema,
  videoContentSchema,
  audioContentSchema,
  fileContentSchema,
  urlContentSchema,
  contactContentSchema,
  textContentSchema,
]);

export const activeContentTypeSchema = z.enum(ACTIVE_CONTENT_TYPES);
export type ActiveContent = z.infer<typeof activeContentSchema>;
