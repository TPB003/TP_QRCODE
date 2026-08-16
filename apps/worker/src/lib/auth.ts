import type { AuthUser } from "@shared/types/domain";
import type { Bindings } from "@worker/bindings";
import { hashValue, nowIso, parseCookies, setCookie, clearCookie } from "@worker/lib/http";
import type { AppContext } from "@worker/lib/http";

export const SESSION_COOKIE = "tp_session";
const CODE_TTL_SECONDS = 10 * 60;
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_CODE_ATTEMPTS = 5;

interface AuthCodeRow {
  id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  used_at: string | null;
}

interface SessionUserRow {
  session_id: string;
  session_expires_at: string;
  user_id: string;
  email: string;
  user_created_at: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAllowedEmail(env: Bindings, email: string): boolean {
  const allowList = env.AUTH_ALLOWED_EMAILS?.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!allowList || allowList.length === 0 || allowList.includes("*")) return true;
  return allowList.includes(email);
}

export async function issueCode(env: Bindings, email: string): Promise<{ code: string; expiresAt: string }> {
  const normalizedEmail = normalizeEmail(email);
  if (!isAllowedEmail(env, normalizedEmail)) {
    throw new Error("AUTH_EMAIL_NOT_ALLOWED");
  }

  // Production must always use the real delivery adapter. In particular,
  // setting AUTH_DELIVERY_MODE=dev in a production binding must never enable
  // the fixed test code or return it to a caller.
  if (env.ENVIRONMENT === "production" && env.AUTH_DELIVERY_MODE !== "resend") {
    throw new Error("AUTH_PRODUCTION_CONFIG_INVALID");
  }
  const developmentAuth = isDevAuth(env);
  const code = developmentAuth && env.AUTH_TEST_CODE?.match(/^\d{6}$/)?.[0]
    ? env.AUTH_TEST_CODE
    : String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();
  if (!developmentAuth) {
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new Error("AUTH_DELIVERY_NOT_CONFIGURED");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [normalizedEmail],
        subject: "TP QR 登录验证码",
        text: `您的 TP QR 登录验证码是 ${code}，10 分钟内有效。如非本人操作，请忽略此邮件。`,
      }),
    });
    if (!response.ok) throw new Error("AUTH_DELIVERY_FAILED");
  }
  await env.DB.prepare("UPDATE auth_codes SET used_at = ? WHERE email = ? AND used_at IS NULL")
    .bind(createdAt, normalizedEmail)
    .run();
  await env.DB.prepare(
    "INSERT INTO auth_codes (id, email, code_hash, expires_at, attempts, used_at, created_at) VALUES (?, ?, ?, ?, 0, NULL, ?)",
  )
    .bind(crypto.randomUUID(), normalizedEmail, await hashValue(code), expiresAt, createdAt)
    .run();
  return { code, expiresAt };
}

export async function verifyCode(env: Bindings, email: string, code: string): Promise<{ user: AuthUser; sessionId: string }> {
  const normalizedEmail = normalizeEmail(email);
  const row = await env.DB.prepare(
    "SELECT id, email, code_hash, expires_at, attempts, used_at FROM auth_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(normalizedEmail)
    .first<AuthCodeRow>();

  if (!row || row.used_at || row.attempts >= MAX_CODE_ATTEMPTS || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("AUTH_CODE_INVALID");
  }

  const valid = (await hashValue(code)) === row.code_hash;
  if (!valid) {
    await env.DB.prepare("UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?").bind(row.id).run();
    throw new Error("AUTH_CODE_INVALID");
  }

  const timestamp = nowIso();
  await env.DB.prepare("UPDATE auth_codes SET used_at = ? WHERE id = ?").bind(timestamp, row.id).run();
  const userId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET updated_at = excluded.updated_at",
  )
    .bind(userId, normalizedEmail, timestamp, timestamp)
    .run();
  const user = await env.DB.prepare("SELECT id, email, created_at AS createdAt FROM users WHERE email = ?")
    .bind(normalizedEmail)
    .first<AuthUser>();
  if (!user) throw new Error("AUTH_USER_CREATE_FAILED");

  const sessionId = await createSession(env, user.id, timestamp);
  return { user, sessionId };
}

export async function createSession(env: Bindings, userId: string, createdAt = nowIso()): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, NULL)")
    .bind(sessionId, userId, expiresAt, createdAt)
    .run();
  return sessionId;
}

export async function currentUser(context: AppContext): Promise<AuthUser | null> {
  const sessionId = parseCookies(context.req.header("Cookie"))[SESSION_COOKIE];
  if (!sessionId) return null;
  const row = await context.env.DB.prepare(
    "SELECT s.id AS session_id, s.expires_at AS session_expires_at, u.id AS user_id, u.email, u.created_at AS user_created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.revoked_at IS NULL LIMIT 1",
  )
    .bind(sessionId)
    .first<SessionUserRow>();
  if (!row || new Date(row.session_expires_at).getTime() <= Date.now()) {
    if (row) await context.env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").bind(nowIso(), sessionId).run();
    return null;
  }
  return { id: row.user_id, email: row.email, createdAt: row.user_created_at };
}

export async function requireUser(context: AppContext): Promise<AuthUser | null> {
  const user = await currentUser(context);
  if (!user) return null;
  return user;
}

export async function revokeSession(context: AppContext): Promise<void> {
  const sessionId = parseCookies(context.req.header("Cookie"))[SESSION_COOKIE];
  if (sessionId) await context.env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").bind(nowIso(), sessionId).run();
  clearCookie(context, SESSION_COOKIE);
}

export function attachSessionCookie(context: AppContext, sessionId: string): void {
  setCookie(context, SESSION_COOKIE, sessionId, SESSION_TTL_SECONDS);
}

export function isDevAuth(env: Bindings): boolean {
  return env.ENVIRONMENT !== "production" && (env.AUTH_DELIVERY_MODE === "dev" || env.ENVIRONMENT === "test");
}
