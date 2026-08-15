import { projectDraftSchema, visualStyleSchema } from "@shared/schemas/project";
import type { ProjectDraft, VisualStyle } from "@shared/types/domain";
import type { Bindings } from "@worker/bindings";
import { jsonParse, nowIso } from "@worker/lib/http";

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  kind: ProjectDraft["kind"];
  status: ProjectDraft["status"];
  revision: number;
  draft_content_json: string;
  visual_style_json: string;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EntityRow {
  id: string;
  project_id: string;
  code_id: string;
  name: string;
  external_id: string;
  fields_json: string;
  slug: string;
  created_at: string;
  deleted_at: string | null;
}

export interface VersionRow {
  id: string;
  project_id: string;
  version: number;
  snapshot_json: string;
  published_at: string;
}

export function getDb(env: Bindings): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  return env.DB;
}

export function defaultVisualStyle(): VisualStyle {
  return visualStyleSchema.parse({
    foreground: "#2563EB",
    background: "#FBF9F3",
    dotStyle: "rounded",
    cornerSquareStyle: "extra-rounded",
    cornerDotStyle: "dot",
    logoAssetId: null,
    frameText: "",
  });
}

export function rowToProject(row: ProjectRow): ProjectDraft {
  return projectDraftSchema.parse({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    revision: row.revision,
    content: jsonParse(row.draft_content_json, { type: "text", value: "" }),
    visualStyle: jsonParse(row.visual_style_json, defaultVisualStyle()),
    publishedVersionId: row.published_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function rowToEntity(row: EntityRow) {
  return {
    id: row.id,
    codeId: row.code_id,
    name: row.name,
    externalId: row.external_id,
    fields: jsonParse<Record<string, string>>(row.fields_json, {}),
    slug: row.slug,
    createdAt: row.created_at,
  };
}

export function rowToVersion(row: VersionRow) {
  const snapshot = projectDraftSchema.parse(jsonParse<unknown>(row.snapshot_json, null));
  return {
    id: row.id,
    projectId: row.project_id,
    version: row.version,
    snapshot,
    publishedAt: row.published_at,
  };
}

export function projectSnapshot(project: ProjectDraft): string {
  return JSON.stringify(project);
}

export function isoDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function updatedProjectValues(project: ProjectDraft) {
  return {
    content: JSON.stringify(project.content),
    visualStyle: JSON.stringify(project.visualStyle),
    updatedAt: nowIso(),
  };
}
