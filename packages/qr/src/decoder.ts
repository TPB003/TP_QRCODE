export type DecodedKind = "tpqr" | "url" | "vcard" | "text" | "invalid";
export interface DecodedPayload { kind: DecodedKind; raw: string; slug?: string; url?: string; }

export function classifyDecodedText(raw: string): DecodedPayload {
  const value = raw.trim();
  if (!value) return { kind: "invalid", raw };
  const slugMatch = value.match(/(?:^|\/)s\/([0-9A-Za-z]{10})(?:$|[?#])/);
  if (slugMatch) return { kind: "tpqr", raw, slug: slugMatch[1] };
  if (/^BEGIN:VCARD[\r\n]/i.test(value)) return { kind: "vcard", raw };
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return { kind: "url", raw, url: url.toString() };
    return { kind: "invalid", raw };
  } catch { return { kind: "text", raw }; }
}

export interface DecoderAdapter { decodeFromImage(source: ImageBitmap | HTMLImageElement | Blob): Promise<string | null>; startCamera(video: HTMLVideoElement, facingMode?: "user" | "environment"): Promise<MediaStream>; stopCamera(stream: MediaStream): void; }
export function stopMediaStream(stream: MediaStream | null | undefined): void { stream?.getTracks().forEach((track) => track.stop()); }
