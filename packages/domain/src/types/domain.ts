import type { z } from "zod";
import type { authUserSchema } from "@shared/schemas/auth";
import type { formFieldSchema, formSchema } from "@shared/schemas/form";
import type {
  entityRecordSchema,
  projectDraftSchema,
  visualStyleSchema,
} from "@shared/schemas/project";

export type AuthUser = z.infer<typeof authUserSchema>;
export type FormField = z.infer<typeof formFieldSchema>;
export type FormSchema = z.infer<typeof formSchema>;
export type ProjectDraft = z.infer<typeof projectDraftSchema>;
export type VisualStyle = z.infer<typeof visualStyleSchema>;
export type EntityRecord = z.infer<typeof entityRecordSchema>;

export interface ProjectVersion {
  id: string;
  projectId: string;
  version: number;
  snapshot: ProjectDraft;
  publishedAt: string;
}

export interface AssetMetadata {
  id: string;
  ownerId: string;
  objectKey: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface Submission {
  id: string;
  projectId: string;
  codeId: string;
  versionId: string;
  values: Record<string, unknown>;
  createdAt: string;
}

export interface DailyAnalytics {
  date: string;
  scans: number;
  submissions: number;
}
