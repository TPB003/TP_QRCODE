import { z, type ZodType } from "zod";
import type { ApiErrorBody, ApiSuccess } from "@shared/contracts/api";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

function isApiSuccess(body: unknown): body is ApiSuccess<unknown> {
  return typeof body === "object" && body !== null && "data" in body;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiClientError";
    this.code = body.error.code;
    this.status = status;
    this.fieldErrors = body.error.fieldErrors;
  }
}

function invalidResponse(status: number): ApiClientError {
  return new ApiClientError(status, {
    error: { code: "INVALID_RESPONSE", message: "服务器返回了无效响应" },
  });
}

async function request<T>(path: string, init: RequestInit = {}, schema?: ZodType<T>): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const body: unknown = response.status === 204 ? null : await response.json();
  const parsedError = apiErrorBodySchema.safeParse(body);

  if (parsedError.success) {
    throw new ApiClientError(response.status, parsedError.data);
  }

  if (!response.ok || !isApiSuccess(body)) {
    throw invalidResponse(response.status);
  }

  return schema ? schema.parse(body.data) : (body.data as T);
}

export const apiClient = {
  get: <T>(path: string, schema?: ZodType<T>) => request(path, { method: "GET" }, schema),
  post: <T>(path: string, data?: unknown, schema?: ZodType<T>) =>
    request(path, { method: "POST", body: data instanceof FormData ? data : JSON.stringify(data ?? {}) }, schema),
  patch: <T>(path: string, data: unknown, schema?: ZodType<T>) =>
    request(path, { method: "PATCH", body: JSON.stringify(data) }, schema),
  delete: <T>(path: string, schema?: ZodType<T>) => request(path, { method: "DELETE" }, schema),
};
