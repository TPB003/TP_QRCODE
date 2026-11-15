export const HEX_COLOR_MESSAGE = "请输入 # 加 6 位十六进制颜色";

export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim();
  const body = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(body)) return null;
  return `#${body.toUpperCase()}`;
}
