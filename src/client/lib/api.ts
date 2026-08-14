import type { FormSchema, ProjectDraft } from "@shared/types/domain";
import { apiClient } from "@client/lib/api-client";

export interface ProjectEntity {
  id: string;
  codeId: string;
  name: string;
  externalId: string;
  fields: Record<string, string>;
  slug: string;
  createdAt: string;
}

export interface ProjectResponse {
  project: ProjectDraft;
  entities: ProjectEntity[];
}

export interface ProjectListResponse {
  items: ProjectDraft[];
  nextCursor: string | null;
}

export interface AnalyticsResponse {
  items: Array<{ date: string; scans: number; submissions: number }>;
  days: number;
}

export interface PublicResponse {
  project: Pick<ProjectDraft, "id" | "name" | "kind" | "content" | "visualStyle" | "revision" | "publishedVersionId" | "updatedAt">;
  version: { id: string; version: number; publishedAt: string };
  entity: ProjectEntity;
}

export const api = {
  requestCode: (email: string) => apiClient.post<{ accepted: boolean; expiresAt: string; testCode?: string }>("/api/auth/request-code", { email }),
  verifyCode: (email: string, code: string) => apiClient.post<{ id: string; email: string; createdAt: string }>("/api/auth/verify-code", { email, code }),
  logout: () => apiClient.post<{ loggedOut: boolean }>("/api/auth/logout"),
  me: () => apiClient.get<{ id: string; email: string; createdAt: string }>("/api/auth/me"),
  templates: () => apiClient.get<Array<{ key: string; label: string }>>("/api/templates"),
  projects: (query?: string) => apiClient.get<ProjectListResponse>(`/api/projects${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  project: (projectId: string) => apiClient.get<ProjectResponse>(`/api/projects/${projectId}`),
  createProject: (name: string, kind: ProjectDraft["kind"], templateKey?: string) => apiClient.post<{ project: ProjectDraft; entity: ProjectEntity }>("/api/projects", { name, kind, templateKey }),
  updateProject: (projectId: string, revision: number, data: Partial<Pick<ProjectDraft, "name" | "content" | "visualStyle" | "status">>) => apiClient.patch<ProjectDraft>(`/api/projects/${projectId}`, { ...data, revision }),
  publishProject: (projectId: string, revision: number) => apiClient.post<{ project: ProjectDraft; version: { id: string; version: number; publishedAt: string } }>(`/api/projects/${projectId}/publish`, { revision }),
  importEntities: (projectId: string, rows: Array<{ name: string; externalId?: string; fields?: Record<string, string> }>) => apiClient.post<{ items: ProjectEntity[]; count: number }>(`/api/projects/${projectId}/entities/import`, { rows }),
  analytics: (projectId: string) => apiClient.get<AnalyticsResponse>(`/api/projects/${projectId}/analytics?days=30`),
  submissions: (projectId: string) => apiClient.get<{ items: Array<{ id: string; codeId: string; versionId: string; values: Record<string, unknown>; attachments: number; createdAt: string }>; nextCursor: string | null }>(`/api/projects/${projectId}/submissions`),
  publicPage: (slug: string) => apiClient.get<PublicResponse>(`/api/public/${encodeURIComponent(slug)}`),
  submitPublic: (slug: string, values: Record<string, unknown>, files: File[] = [], turnstileToken?: string) => {
    const form = new FormData();
    form.set("values", JSON.stringify(values));
    if (turnstileToken) form.set("turnstileToken", turnstileToken);
    files.forEach((file) => form.append("files", file));
    return apiClient.post<{ id: string; createdAt: string }>(`/api/public/${encodeURIComponent(slug)}/submissions`, form);
  },
  uploadAsset: (file: File, purpose = "upload") => {
    const form = new FormData();
    form.set("file", file);
    form.set("purpose", purpose);
    return apiClient.post<{ id: string; contentType: string; size: number; purpose: string }>("/api/assets", form);
  },
};

export function projectFormSchema(project: ProjectDraft): FormSchema | null {
  return project.content.type === "form" || project.content.type === "business" ? project.content.schema : null;
}
