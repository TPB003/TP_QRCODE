import type { Context } from "hono";
import type { Bindings } from "@worker/bindings";

export type AppContext = Context<{ Bindings: Bindings }>;

export function nowIso(): string {
  return new Date().toISOString();
}

export function apiError(
  context: AppContext,
  status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  return context.json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }, status);
}

export async function readJson<T>(context: AppContext): Promise<T | null> {
  try {
    return await context.req.json<T>();
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => Boolean(name && value))
      .map(([name, value]) => [name, decodeURIComponent(value)]),
  );
}

export function setCookie(context: AppContext, name: string, value: string, maxAge: number): void {
  const secure = context.env.ENVIRONMENT === "production" || context.env.ENVIRONMENT === "staging";
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) attributes.push("Secure");
  context.header("Set-Cookie", attributes.join("; "));
}

export function clearCookie(context: AppContext, name: string): void {
  setCookie(context, name, "", 0);
}

export function jsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function hashValue(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeRateLimit(db: D1Database, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const bucketStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  await db.prepare("INSERT INTO rate_limits (rate_key, bucket_start, count) VALUES (?, ?, 1) ON CONFLICT(rate_key, bucket_start) DO UPDATE SET count = count + 1").bind(key, bucketStart).run();
  const row = await db.prepare("SELECT count FROM rate_limits WHERE rate_key = ? AND bucket_start = ?").bind(key, bucketStart).first<{ count: number }>();
  return (row?.count ?? limit + 1) <= limit;
}

export function randomSlug(length = 10): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
