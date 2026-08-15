import type { ActiveContent, ActiveContentType } from "@tpqr/domain";

export const CONTENT_TYPES: readonly ActiveContentType[] = ["image", "video", "audio", "file", "url", "contact", "text"];
const EMPTY_ASSET_ID = "00000000-0000-4000-8000-000000000000";

export const CONTENT_LABELS: Record<ActiveContentType, string> = { image: "图片", video: "视频", audio: "音频", file: "文件", url: "网址", contact: "名片", text: "文字" };

export function emptyContent(type: ActiveContentType): ActiveContent {
  switch (type) {
    case "image": return { type, assetId: EMPTY_ASSET_ID, alt: "", title: "" };
    case "video": return { type, assetId: EMPTY_ASSET_ID, title: "", posterAssetId: null, autoplay: false, loop: false };
    case "audio": return { type, assetId: EMPTY_ASSET_ID, title: "", artist: "", coverAssetId: null };
    case "file": return { type, assetId: EMPTY_ASSET_ID, title: "", description: "", downloadName: "download" };
    case "url": return { type, url: "https://", title: "", description: "" };
    case "contact": return { type, firstName: "", lastName: "", organization: "", title: "", phone: "", email: "", website: "", address: "", note: "" };
    case "text": return { type, title: "", text: "" };
  }
}
