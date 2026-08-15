import type { ActiveContent } from "@tpqr/domain";
import { activeContentSchema } from "@tpqr/domain";

export function validateActiveContent(value: unknown): { success: true; data: ActiveContent } | { success: false; issues: string[] } {
  const result = activeContentSchema.safeParse(value);
  return result.success ? result : { success: false, issues: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
}

export function isValidRenderColor(value: string): boolean { return /^#[0-9a-f]{6}$/i.test(value); }
export function normalizeQrSize(size: number, min = 128, max = 2048): number {
  if (!Number.isFinite(size)) return min;
  return Math.min(max, Math.max(min, Math.round(size)));
}
