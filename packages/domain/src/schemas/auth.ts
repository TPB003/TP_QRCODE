import { z } from "zod";

export const requestCodeSchema = z.object({
  email: z.string().trim().email("请输入有效邮箱地址"),
  turnstileToken: z.string().trim().min(1).optional(),
});

export const verifyCodeSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/, "验证码必须为 6 位数字"),
});

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  loginProvider: z.enum(["email", "google", "github"]).nullable().optional(),
});
