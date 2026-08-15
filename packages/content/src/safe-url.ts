export interface SafeUrlResult { ok: boolean; url?: URL; reason?: string; }

/** Accept only web URLs. Credentials, control characters and dangerous schemes are rejected. */
export function validateSafeUrl(input: string): SafeUrlResult {
  if (typeof input !== "string" || input.trim().length === 0) return { ok: false, reason: "URL_REQUIRED" };
  const value = input.trim();
  if ([...value].some((character) => { const code = character.charCodeAt(0); return code <= 0x1f || code === 0x7f; })) return { ok: false, reason: "URL_CONTROL_CHARACTER" };
  let url: URL;
  try { url = new URL(value); } catch { return { ok: false, reason: "URL_INVALID" }; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "URL_SCHEME_NOT_ALLOWED" };
  if (url.username || url.password) return { ok: false, reason: "URL_CREDENTIALS_NOT_ALLOWED" };
  if (!url.hostname || url.hostname.includes("..")) return { ok: false, reason: "URL_HOST_INVALID" };
  return { ok: true, url };
}

export function isSafeUrl(input: string): boolean { return validateSafeUrl(input).ok; }
