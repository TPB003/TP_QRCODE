import { useMemo } from "react";
import type { ActiveContent, ActiveContentType } from "@tpqr/domain";

export const CONTENT_TYPES: readonly ActiveContentType[] = ["image", "video", "audio", "file", "url", "contact", "text"];
const LABELS: Record<ActiveContentType, string> = { image: "图片", video: "视频", audio: "音频", file: "文件", url: "网址", contact: "名片", text: "文字" };

export function emptyContent(type: ActiveContentType): ActiveContent {
  switch (type) {
    case "image": return { type, assetId: "00000000-0000-0000-0000-000000000000", alt: "", title: "" };
    case "video": return { type, assetId: "00000000-0000-0000-0000-000000000000", title: "", posterAssetId: null, autoplay: false, loop: false };
    case "audio": return { type, assetId: "00000000-0000-0000-0000-000000000000", title: "", artist: "", coverAssetId: null };
    case "file": return { type, assetId: "00000000-0000-0000-0000-000000000000", title: "", description: "", downloadName: "download" };
    case "url": return { type, url: "https://", title: "", description: "" };
    case "contact": return { type, firstName: "", lastName: "", organization: "", title: "", phone: "", email: "", website: "", address: "", note: "" };
    case "text": return { type, title: "", text: "" };
  }
}

type Props = { value: ActiveContent; onChange: (next: ActiveContent) => void; onUpload: (file: File, purpose?: string) => Promise<string>; uploading?: boolean };

export function ContentEditor({ value, onChange, onUpload, uploading = false }: Props) {
  const title = useMemo(() => LABELS[value.type], [value.type]);
  const set = (key: string, next: unknown) => onChange({ ...value, [key]: next });
  const upload = async (file: File | undefined, purpose = value.type) => { if (!file) return; const id = await onUpload(file, purpose); set("assetId", id); };
  return <section className="tp-content-editor" aria-label="活码内容编辑器">
    <div className="tp-content-types" role="tablist" aria-label="内容类型">
      {CONTENT_TYPES.map((type) => <button key={type} type="button" role="tab" aria-selected={type === value.type} className={type === value.type ? "is-active" : ""} onClick={() => onChange(emptyContent(type))}>{LABELS[type]}</button>)}
    </div>
    <h2>{title}内容</h2>
    {(value.type === "image" || value.type === "video" || value.type === "audio" || value.type === "file") && <label className="tp-upload-field"><span>{value.type === "file" ? "选择文件" : `上传${title}`}</span><input type="file" accept={value.type === "image" ? "image/*" : value.type === "video" ? "video/*" : value.type === "audio" ? "audio/*" : undefined} disabled={uploading} onChange={(e) => void upload(e.target.files?.[0])} />{uploading ? <small>上传中…</small> : value.assetId.startsWith("00000000") ? <small>尚未上传</small> : <small>已上传资源：{value.assetId.slice(0, 8)}</small>}</label>}
    {value.type === "image" && <><label><span>标题</span><input value={value.title} onChange={(e) => set("title", e.target.value)} /></label><label><span>替代文本</span><input value={value.alt} onChange={(e) => set("alt", e.target.value)} /></label></>}
    {value.type === "video" && <><label><span>标题</span><input value={value.title} onChange={(e) => set("title", e.target.value)} /></label><label className="tp-check"><input type="checkbox" checked={value.autoplay} onChange={(e) => set("autoplay", e.target.checked)} />自动播放（静音）</label><label className="tp-check"><input type="checkbox" checked={value.loop} onChange={(e) => set("loop", e.target.checked)} />循环播放</label></>}
    {value.type === "audio" && <><label><span>标题</span><input value={value.title} onChange={(e) => set("title", e.target.value)} /></label><label><span>艺术家</span><input value={value.artist} onChange={(e) => set("artist", e.target.value)} /></label></>}
    {value.type === "file" && <><label><span>显示标题</span><input value={value.title} onChange={(e) => set("title", e.target.value)} /></label><label><span>文件名</span><input value={value.downloadName} onChange={(e) => set("downloadName", e.target.value)} /></label><label><span>描述</span><textarea value={value.description} onChange={(e) => set("description", e.target.value)} /></label></>}
    {value.type === "url" && <><label><span>安全网址</span><input type="url" value={value.url} onChange={(e) => set("url", e.target.value)} placeholder="https://example.com" /></label><label><span>标题</span><input value={value.title} onChange={(e) => set("title", e.target.value)} /></label><label><span>描述</span><textarea value={value.description} onChange={(e) => set("description", e.target.value)} /></label></>}
    {value.type === "text" && <><label><span>标题</span><input value={value.title} onChange={(e) => set("title", e.target.value)} /></label><label><span>正文</span><textarea maxLength={4000} value={value.text} onChange={(e) => set("text", e.target.value)} /></label><small>{value.text.length}/4000</small></>}
    {value.type === "contact" && <div className="tp-contact-grid">{([["firstName", "名"], ["lastName", "姓"], ["organization", "组织"], ["title", "职位"], ["phone", "电话"], ["email", "邮箱"], ["website", "网站"], ["address", "地址"]] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type={key === "email" ? "email" : key === "website" ? "url" : "text"} value={value[key]} onChange={(e) => set(key, e.target.value)} /></label>)}<label><span>备注</span><textarea value={value.note} onChange={(e) => set("note", e.target.value)} /></label></div>}
  </section>;
}
