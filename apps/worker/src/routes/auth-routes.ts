import { Hono } from "hono";
import { requestCodeSchema, verifyCodeSchema } from "@shared/schemas/auth";
import type { Bindings } from "@worker/bindings";
import { attachSessionCookie, currentUser, isDevAuth, issueCode, revokeSession, verifyCode } from "@worker/lib/auth";
import { completeOAuth, createAuthorizationUrl, enabledProviders, OAuthError } from "@worker/lib/oauth";
import { apiError, consumeRateLimit, readJson, type AppContext } from "@worker/lib/http";

export const authRoutes = new Hono<{ Bindings: Bindings }>();

function oauthFailure(context: AppContext, code: string): Response {
  const safeCode = ["AUTH_PROVIDER_DISABLED", "AUTH_OAUTH_STATE_INVALID", "AUTH_PROVIDER_EMAIL_UNVERIFIED", "AUTH_OAUTH_CONFIG_INVALID"].includes(code)
    ? code
    : "AUTH_OAUTH_FAILED";
  return context.redirect(`${context.env.APP_ORIGIN}/login?oauth_error=${encodeURIComponent(safeCode)}`);
}

authRoutes.get("/providers", (context) => context.json({ data: enabledProviders(context.env) }));

for (const provider of ["google", "github"] as const) {
  authRoutes.get(`/${provider}/start`, async (context) => {
    try {
      const source = context.req.header("CF-Connecting-IP") ?? "unknown";
      if (!(await consumeRateLimit(context.env.DB, `oauth:start:${provider}:${source}`, 20, 10 * 60))) {
        return oauthFailure(context, "AUTH_OAUTH_RATE_LIMITED");
      }
      const url = await createAuthorizationUrl(context.env, provider, context.req.query("returnTo"));
      return context.redirect(url);
    } catch (error) {
      return oauthFailure(context, error instanceof OAuthError ? error.code : "AUTH_OAUTH_FAILED");
    }
  });
  authRoutes.get(`/${provider}/callback`, async (context) => {
    try {
      const source = context.req.header("CF-Connecting-IP") ?? "unknown";
      if (!(await consumeRateLimit(context.env.DB, `oauth:callback:${provider}:${source}`, 20, 10 * 60))) {
        return oauthFailure(context, "AUTH_OAUTH_RATE_LIMITED");
      }
      const result = await completeOAuth(context.env, provider, context.req.query("code") ?? "", context.req.query("state") ?? "");
      attachSessionCookie(context, result.sessionId);
      return context.redirect(new URL(result.returnTo, context.env.APP_ORIGIN).toString());
    } catch (error) {
      const code = error instanceof OAuthError ? error.code : "AUTH_OAUTH_FAILED";
      // Keep the diagnostic bounded to a non-sensitive error code. Provider
      // tokens and response bodies must never enter Worker logs or redirects.
      console.error("oauth_callback_failed", { provider, code });
      return oauthFailure(context, code);
    }
  });
}

authRoutes.post("/request-code", async (context) => {
  const body = await readJson<unknown>(context);
  const parsed = requestCodeSchema.safeParse(body);
  if (!parsed.success) return apiError(context, 422, "VALIDATION_ERROR", "邮箱地址无效", { email: ["请输入有效邮箱地址"] });
  if (!isDevAuth(context.env) && !(await consumeRateLimit(context.env.DB, `auth:${parsed.data.email.toLowerCase()}`, 5, 60 * 60))) return apiError(context, 429, "RATE_LIMITED", "验证码请求过于频繁，请稍后再试");
  try {
    const result = await issueCode(context.env, parsed.data.email);
    return context.json({
      data: {
        accepted: true,
        expiresAt: result.expiresAt,
        ...(isDevAuth(context.env) ? { testCode: result.code } : {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_EMAIL_NOT_ALLOWED") {
      return apiError(context, 403, "FORBIDDEN", "该邮箱不在内部验收名单中");
    }
    if (error instanceof Error && ["AUTH_DELIVERY_NOT_CONFIGURED", "AUTH_DELIVERY_FAILED", "AUTH_PRODUCTION_CONFIG_INVALID"].includes(error.message)) {
      return apiError(context, 503, "AUTH_DELIVERY_UNAVAILABLE", "验证码服务暂不可用，请联系管理员");
    }
    throw error;
  }
});

authRoutes.post("/verify-code", async (context) => {
  const body = await readJson<unknown>(context);
  const parsed = verifyCodeSchema.safeParse(body);
  if (!parsed.success) return apiError(context, 422, "VALIDATION_ERROR", "验证码格式无效");
  try {
    const result = await verifyCode(context.env, parsed.data.email, parsed.data.code);
    attachSessionCookie(context, result.sessionId);
    return context.json({ data: result.user });
  } catch (error) {
    if (error instanceof Error && ["AUTH_CODE_INVALID", "AUTH_USER_CREATE_FAILED"].includes(error.message)) {
      return apiError(context, 401, "UNAUTHORIZED", "验证码无效或已过期");
    }
    throw error;
  }
});

authRoutes.post("/logout", async (context) => {
  await revokeSession(context);
  return context.json({ data: { loggedOut: true } });
});

authRoutes.get("/me", async (context) => {
  const user = await currentUser(context);
  if (!user) return apiError(context, 401, "UNAUTHORIZED", "请先登录");
  return context.json({ data: user });
});
