import { z } from "zod";
import { FORM_FIELD_TYPES, PRODUCT_LIMITS } from "@shared/constants/product";

export const formFieldSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(FORM_FIELD_TYPES),
  label: z.string().trim().min(1).max(50),
  description: z.string().trim().max(200).optional(),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
});

export const formSchema = z.object({
  title: z.string().trim().min(1).max(50),
  description: z.string().trim().max(200).default(""),
  coverAssetId: z.string().uuid().nullable().default(null),
  fields: z.array(formFieldSchema).max(PRODUCT_LIMITS.formFields),
});

export const submissionPayloadSchema = z.object({
  values: z.record(z.string(), z.unknown()),
  turnstileToken: z.string().trim().min(1).optional(),
});
