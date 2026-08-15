export interface FileRule { mime: string; extensions: string[]; maxBytes: number; magic?: Uint8Array[]; }
export interface FileValidation { ok: boolean; reason?: "EMPTY" | "SIZE" | "MIME" | "EXTENSION" | "MAGIC"; }

const MAGIC: Record<string, Uint8Array[]> = {
  "image/png": [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  "image/jpeg": [Uint8Array.from([0xff, 0xd8, 0xff])],
  "image/gif": [Uint8Array.from([0x47, 0x49, 0x46, 0x38])],
  "application/pdf": [Uint8Array.from([0x25, 0x50, 0x44, 0x46])],
  "video/mp4": [Uint8Array.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])],
  "audio/ogg": [Uint8Array.from([0x4f, 0x67, 0x67, 0x53])],
  "audio/wav": [Uint8Array.from([0x52, 0x49, 0x46, 0x46])],
};

export const FILE_RULES: Record<string, FileRule> = {
  "image/png": { mime: "image/png", extensions: [".png"], maxBytes: 10 * 1024 * 1024, magic: MAGIC["image/png"] },
  "image/jpeg": { mime: "image/jpeg", extensions: [".jpg", ".jpeg"], maxBytes: 10 * 1024 * 1024, magic: MAGIC["image/jpeg"] },
  "image/webp": { mime: "image/webp", extensions: [".webp"], maxBytes: 10 * 1024 * 1024 },
  "image/gif": { mime: "image/gif", extensions: [".gif"], maxBytes: 10 * 1024 * 1024, magic: MAGIC["image/gif"] },
  "video/mp4": { mime: "video/mp4", extensions: [".mp4"], maxBytes: 50 * 1024 * 1024, magic: MAGIC["video/mp4"] },
  "video/webm": { mime: "video/webm", extensions: [".webm"], maxBytes: 50 * 1024 * 1024 },
  "audio/mpeg": { mime: "audio/mpeg", extensions: [".mp3"], maxBytes: 50 * 1024 * 1024 },
  "audio/mp4": { mime: "audio/mp4", extensions: [".m4a"], maxBytes: 50 * 1024 * 1024 },
  "audio/wav": { mime: "audio/wav", extensions: [".wav"], maxBytes: 50 * 1024 * 1024, magic: MAGIC["audio/wav"] },
  "audio/ogg": { mime: "audio/ogg", extensions: [".ogg"], maxBytes: 50 * 1024 * 1024, magic: MAGIC["audio/ogg"] },
  "application/pdf": { mime: "application/pdf", extensions: [".pdf"], maxBytes: 100 * 1024 * 1024, magic: MAGIC["application/pdf"] },
  "text/plain": { mime: "text/plain", extensions: [".txt"], maxBytes: 10 * 1024 * 1024 },
};

function startsWithBytes(bytes: Uint8Array, signature: Uint8Array): boolean {
  return bytes.length >= signature.length && signature.every((byte, i) => bytes[i] === byte);
}
export function validateFile(file: { name: string; type: string; size: number }, header?: Uint8Array): FileValidation {
  if (!file || !file.name || !file.type || file.size <= 0) return { ok: false, reason: "EMPTY" };
  const rule = FILE_RULES[file.type];
  if (!rule) return { ok: false, reason: "MIME" };
  if (file.size > rule.maxBytes) return { ok: false, reason: "SIZE" };
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!rule.extensions.includes(extension)) return { ok: false, reason: "EXTENSION" };
  if (header && rule.magic && !rule.magic.some((signature) => startsWithBytes(header, signature))) return { ok: false, reason: "MAGIC" };
  return { ok: true };
}
export function getFileRule(mime: string): FileRule | undefined { return FILE_RULES[mime]; }
