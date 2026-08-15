import type { ZodIssue } from "zod";

export interface ApiSuccess<T> { data: T; }
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    issues?: ZodIssue[];
    requestId?: string;
  };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}
export interface PaginationQuery { cursor?: string; limit?: number; }
export interface RevisionedRequest { revision: number; }
export interface RevisionConflict { code: "REVISION_CONFLICT"; expected: number; actual: number; }
export type PublishStatus = "draft" | "published" | "paused" | "deleted";
