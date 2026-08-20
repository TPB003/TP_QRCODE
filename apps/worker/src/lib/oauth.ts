import type { AuthUser } from "@shared/types/domain";
import type { Bindings } from "@worker/bindings";
import { createSession } from "@worker/lib/auth";
import { hashValue, nowIso } from "@worker/lib/http";

export type OAuthProvider = "google" | "github";

interface OAuthStateRow {
  id: string;
  provider: OAuthProvider;
  code_verifier: string;
  nonce: string | null;
  return_to: string;
  expires_at: string;
  used_at: string | null;
}

interface ProviderProfile {
  subject: string;
  email: string;
}

export class OAuthError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "OAuthError";
    this.code = code;
  }
}

const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const ALLOWED_RETURN_PREFIXES = ["/app", "/decoder"];

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function randomToken(size = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)));
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  const path = value.split(/[?#]/u, 1)[0] ?? "/app";
  return ALLOWED_RETURN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ? value : "/app";
}

function callbackOrigin(env: Bindings): string {
  const origin = env.AUTH_OAUTH_CALLBACK_ORIGIN?.trim() || env.APP_ORIGIN;
  try {
    const url = new URL(origin);
    if (!/^https?:$/u.test(url.protocol)) throw new Error("invalid protocol");
    return url.origin;
  } catch {
    throw new OAuthError("AUTH_OAUTH_CONFIG_INVALID");
  }
}

function callbackUri(env: Bindings, provider: OAuthProvider): string {
  return `${callbackOrigin(env)}/api/auth/${provider}/callback`;
}

function providerEnabled(env: Bindings, provider: OAuthProvider): boolean {
  return provider === "google"
    ? Boolean(env.AUTH_GOOGLE_CLIENT_ID && env.AUTH_GOOGLE_CLIENT_SECRET)
    : Boolean(env.AUTH_GITHUB_CLIENT_ID && env.AUTH_GITHUB_CLIENT_SECRET);
}

export function enabledProviders(env: Bindings): { google: boolean; github: boolean } {
  return { google: providerEnabled(env, "google"), github: providerEnabled(env, "github") };
}

function requireProviderConfig(env: Bindings, provider: OAuthProvider): { clientId: string; clientSecret: string } {
  const clientId = provider === "google" ? env.AUTH_GOOGLE_CLIENT_ID : env.AUTH_GITHUB_CLIENT_ID;
  const clientSecret = provider === "google" ? env.AUTH_GOOGLE_CLIENT_SECRET : env.AUTH_GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret || clientId.startsWith("replace-with-")) throw new OAuthError("AUTH_PROVIDER_DISABLED");
  return { clientId, clientSecret };
}

export async function createAuthorizationUrl(env: Bindings, provider: OAuthProvider, requestedReturnTo?: string | null): Promise<string> {
  const { clientId } = requireProviderConfig(env, provider);
  const state = randomToken();
  const verifier = randomToken(48);
  const nonce = provider === "google" ? randomToken() : null;
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO oauth_states (id, provider, state_hash, code_verifier, nonce, return_to, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)",
  )
    .bind(crypto.randomUUID(), provider, await hashValue(state), verifier, nonce, safeReturnTo(requestedReturnTo), expiresAt, timestamp)
    .run();

  const challenge = await codeChallenge(verifier);
  const redirectUri = callbackUri(env, provider);
  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
      nonce: nonce ?? "",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  // GitHub Apps use fine-grained permissions configured on the App, not
  // OAuth scopes or PKCE parameters. Keep the request aligned with GitHub's
  // App web-authorization flow; state still protects the callback from CSRF.
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

async function consumeState(env: Bindings, provider: OAuthProvider, state: string): Promise<OAuthStateRow> {
  const row = await env.DB.prepare(
    "SELECT id, provider, code_verifier, nonce, return_to, expires_at, used_at FROM oauth_states WHERE provider = ? AND state_hash = ? LIMIT 1",
  )
    .bind(provider, await hashValue(state))
    .first<OAuthStateRow>();
  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) throw new OAuthError("AUTH_OAUTH_STATE_INVALID");
  const updated = await env.DB.prepare("UPDATE oauth_states SET used_at = ? WHERE id = ? AND used_at IS NULL")
    .bind(nowIso(), row.id)
    .run();
  if (!updated.meta.changes) throw new OAuthError("AUTH_OAUTH_STATE_INVALID");
  return row;
}

function parseJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  if (!payload) throw new OAuthError("AUTH_PROVIDER_RESPONSE_INVALID");
  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch {
    throw new OAuthError("AUTH_PROVIDER_RESPONSE_INVALID");
  }
}

async function exchangeGoogle(env: Bindings, code: string, state: OAuthStateRow): Promise<ProviderProfile> {
  const { clientId, clientSecret } = requireProviderConfig(env, "google");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: state.code_verifier,
      redirect_uri: callbackUri(env, "google"),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new OAuthError("AUTH_PROVIDER_EXCHANGE_FAILED");
  const token = asRecord(await response.json());
  const accessToken = asString(token.access_token);
  const idToken = asString(token.id_token);
  if (!accessToken || !idToken) throw new OAuthError("AUTH_PROVIDER_RESPONSE_INVALID");
  const claims = parseJwtPayload(idToken);
  if (claims.nonce !== state.nonce) throw new OAuthError("AUTH_OAUTH_NONCE_INVALID");
  const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!tokenInfoResponse.ok) throw new OAuthError("AUTH_PROVIDER_RESPONSE_INVALID");
  const tokenInfo = asRecord(await tokenInfoResponse.json());
  const issuer = tokenInfo.iss;
  const audience = tokenInfo.aud;
  const expiry = Number(tokenInfo.exp);
  const emailVerified = tokenInfo.email_verified === true || tokenInfo.email_verified === "true";
  if ((issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") || audience !== clientId || expiry * 1000 <= Date.now() || !emailVerified) {
    throw new OAuthError("AUTH_PROVIDER_EMAIL_UNVERIFIED");
  }
  const subject = asString(tokenInfo.sub ?? claims.sub) ?? "";
  const email = (asString(tokenInfo.email) ?? "").trim().toLowerCase();
  if (!subject || !email || !isEmail(email)) throw new OAuthError("AUTH_PROVIDER_RESPONSE_INVALID");
  return { subject, email };
}

async function exchangeGitHub(env: Bindings, code: string): Promise<ProviderProfile> {
  const { clientId, clientSecret } = requireProviderConfig(env, "github");
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUri(env, "github") }),
  });
  if (!response.ok) throw new OAuthError("AUTH_PROVIDER_EXCHANGE_FAILED");
  const token = asRecord(await response.json());
  const accessToken = asString(token.access_token);
  if (!accessToken) throw new OAuthError("AUTH_PROVIDER_RESPONSE_INVALID");
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "TPQRCODE",
  };
  const userResponse = await fetch("https://api.github.com/user", { headers });
  const emailResponse = await fetch("https://api.github.com/user/emails", { headers });
  if (!userResponse.ok || !emailResponse.ok) throw new OAuthError("AUTH_PROVIDER_RESPONSE_INVALID");
  const user = asRecord(await userResponse.json());
  const emailPayload = await emailResponse.json();
  const emails = Array.isArray(emailPayload) ? emailPayload.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
  const selected = emails.find((item) => item.verified === true && item.primary === true) ?? emails.find((item) => item.verified === true);
  const email = (asString(selected?.email) ?? "").trim().toLowerCase();
  const subject = asString(user.id);
  if (!subject || !email || !isEmail(email)) throw new OAuthError("AUTH_PROVIDER_EMAIL_UNVERIFIED");
  return { subject, email };
}

async function userForIdentity(env: Bindings, provider: OAuthProvider, profile: ProviderProfile): Promise<AuthUser> {
  const timestamp = nowIso();
  const identity = await env.DB.prepare("SELECT user_id FROM auth_identities WHERE provider = ? AND provider_subject = ? LIMIT 1")
    .bind(provider, profile.subject)
    .first<{ user_id: string }>();
  let userId = identity?.user_id;
  if (!userId) {
    userId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET updated_at = excluded.updated_at")
      .bind(userId, profile.email, timestamp, timestamp)
      .run();
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(profile.email).first<{ id: string }>();
    if (!existing) throw new OAuthError("AUTH_USER_CREATE_FAILED");
    userId = existing.id;
    await env.DB.prepare("INSERT INTO auth_identities (id, user_id, provider, provider_subject, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider, provider_subject) DO UPDATE SET last_login_at = excluded.last_login_at, email = excluded.email")
      .bind(crypto.randomUUID(), userId, provider, profile.subject, profile.email, timestamp, timestamp)
      .run();
  } else {
    await env.DB.prepare("UPDATE auth_identities SET last_login_at = ?, email = ? WHERE provider = ? AND provider_subject = ?")
      .bind(timestamp, profile.email, provider, profile.subject)
      .run();
  }
  const user = await env.DB.prepare("SELECT id, email, created_at AS createdAt FROM users WHERE id = ? LIMIT 1")
    .bind(userId)
    .first<AuthUser>();
  if (!user) throw new OAuthError("AUTH_USER_CREATE_FAILED");
  return user;
}

export async function completeOAuth(env: Bindings, provider: OAuthProvider, code: string, state: string): Promise<{ user: AuthUser; sessionId: string; returnTo: string }> {
  if (!code || !state) throw new OAuthError("AUTH_OAUTH_STATE_INVALID");
  const stateRow = await consumeState(env, provider, state);
  const profile = provider === "google" ? await exchangeGoogle(env, code, stateRow) : await exchangeGitHub(env, code);
  const user = await userForIdentity(env, provider, profile);
  return { user, sessionId: await createSession(env, user.id), returnTo: stateRow.return_to };
}
