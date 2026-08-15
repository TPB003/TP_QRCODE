import type { QrOutputFormat } from "@tpqr/domain";

export const QR_OUTPUT_FORMATS: readonly QrOutputFormat[] = ["png", "svg", "webp", "jpg"];
export function qrMimeType(format: QrOutputFormat): string {
  return format === "svg" ? "image/svg+xml" : format === "jpg" ? "image/jpeg" : `image/${format}`;
}
export function qrFileName(slug: string, format: QrOutputFormat): string { return `tp-qr-${slug}.${format}`; }

export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof document === "undefined") return;
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href; anchor.download = fileName; anchor.rel = "noopener";
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(href));
}

export async function shareOrDownload(blob: Blob, fileName: string): Promise<"shared" | "downloaded"> {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const FileCtor = typeof File !== "undefined" ? File : undefined;
  if (nav?.share && FileCtor) {
    try {
      const file = new FileCtor([blob], fileName, { type: blob.type });
      if (!nav.canShare || nav.canShare({ files: [file] })) { await nav.share({ files: [file], title: fileName }); return "shared"; }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }
  downloadBlob(blob, fileName); return "downloaded";
}
