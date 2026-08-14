import { Hono } from "hono";
import { requestCodeSchema, verifyCodeSchema } from "@shared/schemas/auth";
import type { Bindings } from "@worker/bindings";
import { attachSessionCookie, currentUser, isDevAuth, issueCode, revokeSession, verifyCode } from "@worker/lib/auth";
import { apiError, consumeRateLimit, readJson } from "@worker/lib/http";

export const authRoutes = new Hono<{ Bindings: Bindings }>();

authRoutes.post("/request-code", async (context) => {
  const body = await readJson<unknown>(context);
  const parsed = requestCodeSchema.safeParse(body);
  if (!parsed.success) return apiError(context, 422, "VALIDATION_ERROR", "邮箱地址无效", { email: ["请输入有效邮箱地址"] });
  if (context.env.AUTH_DELIVERY_MODE !== "dev" && !(await consumeRateLimit(context.env.DB, `auth:${parsed.data.email.toLowerCase()}`, 5, 60 * 60))) return apiError(context, 429, "RATE_LIMITED", "验证码请求过于频繁，请稍后再试");
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
