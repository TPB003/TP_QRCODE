import { useMemo } from "react";
import type { ActiveContent } from "@tpqr/domain";
import { CONTENT_LABELS, CONTENT_TYPES, emptyContent } from "./content-editor-model";
import "./content-editor.css";

type Props = { value: ActiveContent; onChange: (next: ActiveContent) => void; onUpload: (file: File, purpose?: string) => Promise<string>; uploading?: boolean; fieldErrors?: Record<string, string[]> };

export function ContentEditor({ value, onChange, onUpload, uploading = false, fieldErrors = {} }: Props) {
  const title = useMemo(() => CONTENT_LABELS[value.type], [value.type]);
  const set = (key: string, next: unknown) => onChange({ ...value, [key]: next });
  const errorFor = (key: string) => fieldErrors[`content.${key}`]?.[0] ?? fieldErrors[key]?.[0];
  const fieldError = (key: string) => { const message = errorFor(key); return message ? <small className="tp-field-error" role="alert">{message}</small> : null; };
  const upload = async (file: File | undefined, purpose = value.type) => { if (!file) return; const id = await onUpload(file, purpose); set("assetId", id); };
  return <section className="tp-content-editor" aria-label="活码内容编辑器">
    <div className="tp-content-editor__header">
      <div>
        <span className="tp-content-editor__eyebrow">CONTENT PAYLOAD</span>
        <h2>{title}内容</h2>
      </div>
      <small className="tp-content-editor__hint">二维码只保存一个内容版本，发布后扫码页面只展示这里的内容。</small>
    </div>
    <div className="tp-content-types" role="tablist" aria-label="内容类型">
      {CONTENT_TYPES.map((type) => <button key={type} type="button" role="tab" aria-selected={type === value.type} className={type === value.type ? "is-active" : ""} onClick={() => onChange(emptyContent(type))}>{CONTENT_LABELS[type]}</button>)}
    </div>
    <div className={`tp-content-fields tp-content-fields--${value.type}`}>
      {(value.type === "image" || value.type === "video" || value.type === "audio" || value.type === "file") && <label className={`tp-upload-field${value.assetId.startsWith("00000000") ? " is-empty" : " is-ready"}`}><span>{value.type === "file" ? "选择文件" : `上传${title}`}</span><input type="file" accept={value.type === "image" ? "image/*" : value.type === "video" ? "video/*" : value.type === "audio" ? "audio/*" : undefined} disabled={uploading} onChange={(e) => void upload(e.target.files?.[0])} />{uploading ? <small role="status">上传中…</small> : value.assetId.startsWith("00000000") ? <small>点击此区域选择文件，发布前必须完成上传</small> : <small role="status">已上传资源：{value.assetId.slice(0, 8)}</small>}{fieldError("assetId")}</label>}
      {value.type === "image" && <div className="tp-field-group"><label><span>标题（可选）</span><input value={value.title} onChange={(e) => set("title", e.target.value)} />{fieldError("title")}</label><label><span>替代文本（可选）</span><input value={value.alt} onChange={(e) => set("alt", e.target.value)} />{fieldError("alt")}</label></div>}
      {value.type === "video" && <div className="tp-field-group"><label><span>标题（可选）</span><input value={value.title} onChange={(e) => set("title", e.target.value)} />{fieldError("title")}</label><div className="tp-checks"><label className="tp-check"><input type="checkbox" checked={value.autoplay} onChange={(e) => set("autoplay", e.target.checked)} />自动播放（静音）</label><label className="tp-check"><input type="checkbox" checked={value.loop} onChange={(e) => set("loop", e.target.checked)} />循环播放</label></div></div>}
      {value.type === "audio" && <div className="tp-field-group"><label><span>标题（可选）</span><input value={value.title} onChange={(e) => set("title", e.target.value)} />{fieldError("title")}</label><label><span>艺术家（可选）</span><input value={value.artist} onChange={(e) => set("artist", e.target.value)} />{fieldError("artist")}</label></div>}
      {value.type === "file" && <div className="tp-field-group"><label><span>显示标题（可选）</span><input value={value.title} onChange={(e) => set("title", e.target.value)} />{fieldError("title")}</label><label><span>下载文件名</span><input value={value.downloadName} onChange={(e) => set("downloadName", e.target.value)} />{fieldError("downloadName")}</label><label><span>描述（可选）</span><textarea value={value.description} onChange={(e) => set("description", e.target.value)} />{fieldError("description")}</label></div>}
      {value.type === "url" && <div className="tp-field-group"><label><span>安全网址</span><input type="url" value={value.url} onChange={(e) => set("url", e.target.value)} placeholder="https://example.com" />{fieldError("url")}</label><label><span>标题（可选）</span><input value={value.title} onChange={(e) => set("title", e.target.value)} />{fieldError("title")}</label><label><span>描述（可选）</span><textarea value={value.description} onChange={(e) => set("description", e.target.value)} />{fieldError("description")}</label></div>}
      {value.type === "text" && <div className="tp-field-group"><label><span>标题（可选）</span><input value={value.title} onChange={(e) => set("title", e.target.value)} />{fieldError("title")}</label><label><span>正文</span><textarea maxLength={4000} value={value.text} onChange={(e) => set("text", e.target.value)} />{fieldError("text")}</label><small className="tp-character-count">{value.text.length}/4000</small></div>}
      {value.type === "contact" && <div className="tp-contact-grid">{([["firstName", "名"], ["lastName", "姓"], ["organization", "组织"], ["title", "职位"], ["phone", "电话"], ["email", "邮箱"], ["website", "网站"], ["address", "地址"]] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type={key === "email" ? "email" : key === "website" ? "url" : "text"} value={value[key]} onChange={(e) => set(key, e.target.value)} />{fieldError(key)}</label>)}<label><span>备注（可选）</span><textarea value={value.note} onChange={(e) => set("note", e.target.value)} />{fieldError("note")}</label></div>}
    </div>
  </section>;
}
