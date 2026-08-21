import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Eye, Loader2, Palette, Save, Send, Share2, Upload, X } from "lucide-react";
import QRCodeStyling from "qr-code-styling";
import { useParams, useSearchParams } from "react-router-dom";
import type { ActiveContent, PublicContentResponse, QrRenderConfig } from "@tpqr/domain";
import { buildPublicPayload, DEFAULT_QR_RENDER_CONFIG } from "@tpqr/qr";
import { ProjectShell } from "@client/components/layout/project-shell";
import { ApiClientError, apiClient } from "@client/lib/api-client";
import { ContentEditor } from "@client/features/content-editor/content-editor";
import { emptyContent } from "@client/features/content-editor/content-editor-model";
import "@client/features/public-content/public-content.css";
import { PublicContentFrame } from "@client/features/public-content/public-content-frame";
import calibrationBackdrop from "../../../../../../assets/open/qr-workbench-calibration.png";
import "../qr-editor.css";
import "../qr-editor-overrides.css";

type Code = { id: string; slug: string; title: string; contentType: ActiveContent["type"]; status: "active" | "draft" | "published" | "paused" | "deleted"; revision: number; publishedVersion?: number | null; content: ActiveContent; render: QrRenderConfig; publishedVersionId?: string | null; updatedAt?: string };
type CodeResponse = Code;
type NoticeKind = "success" | "error" | "info";
type EditorNotice = { kind: NoticeKind; message: string };

async function uploadAsset(codeId: string, file: File, purpose: string) { const form = new FormData(); form.set("file", file); form.set("purpose", purpose); const result = await apiClient.post<{ id: string }>(`/api/codes/${encodeURIComponent(codeId)}/assets`, form); return result.id; }
async function loadCode(id: string) { return apiClient.get<CodeResponse>(`/api/codes/${encodeURIComponent(id)}`); }
async function saveCode(id: string, revision: number, body: { content: ActiveContent; render: QrRenderConfig; title: string }) { return apiClient.patch<Code>(`/api/codes/${encodeURIComponent(id)}`, { ...body, revision }); }
async function publishCode(id: string, revision: number) { return apiClient.post<{ codeId: string; slug: string; version: { id: string; version: number; revision: number; publishedAt: string } }>(`/api/codes/${encodeURIComponent(id)}/publish`, { revision }); }

function logoUrl(render: QrRenderConfig): string | undefined {
  return render.logoAssetId ? `/api/assets/${encodeURIComponent(render.logoAssetId)}` : undefined;
}

function qrOptions(data: string, render: QrRenderConfig, type: "canvas" | "svg") {
  const image = logoUrl(render);
  return {
    type,
    width: render.size,
    height: render.size,
    data,
    margin: render.margin,
    image,
    imageOptions: {
      saveAsBlob: true,
      hideBackgroundDots: Boolean(image),
      imageSize: image ? Math.min(0.34, Math.max(0.12, (render.logoSize ?? 56) / Math.max(render.size, 1))) : 0.2,
      margin: image ? 6 : 0,
      crossOrigin: "anonymous",
    },
    dotsOptions: { type: render.dotStyle, color: render.foreground },
    cornersSquareOptions: { type: render.cornerSquareStyle, color: render.foreground },
    cornersDotOptions: { type: render.cornerDotStyle, color: render.foreground },
    backgroundOptions: { color: render.background },
    qrOptions: { errorCorrectionLevel: render.errorCorrectionLevel },
  };
}

async function qrBlob(data: string, render: QrRenderConfig, format: "png" | "svg" | "webp" | "jpg"): Promise<Blob> {
  const qr = new QRCodeStyling(qrOptions(data, render, format === "svg" ? "svg" : "canvas"));
  const blob = await qr.getRawData(format === "jpg" ? "jpeg" : format);
  if (!blob) throw new Error("二维码生成失败");
  return blob instanceof Blob ? blob : new Blob([blob as BlobPart], { type: format === "svg" ? "image/svg+xml" : `image/${format === "jpg" ? "jpeg" : format}` });
}
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function shareOrDownload(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  const mobile = typeof window !== "undefined" && (window.matchMedia("(max-width: 768px)").matches || navigator.maxTouchPoints > 0);
  const canShareFile = mobile && typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }));
  if (canShareFile) {
    try { await navigator.share({ files: [file], title: name }); return "shared" as const; }
    catch (error) { if (error instanceof DOMException && error.name === "AbortError") throw error; }
  }
  downloadBlob(blob, name);
  return "downloaded" as const;
}

export function QrEditorView() {
  const { projectId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const requestedType = searchParams.get("type") as ActiveContent["type"] | null;
  const [code, setCode] = useState<Code | null>(null); const [content, setContent] = useState<ActiveContent>(emptyContent("text")); const [render, setRender] = useState<QrRenderConfig>(DEFAULT_QR_RENDER_CONFIG); const [title, setTitle] = useState("我的活码"); const [notice, setNotice] = useState<EditorNotice | null>(null); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [format, setFormat] = useState<"png" | "svg" | "webp" | "jpg">("png"); const [previewOpen, setPreviewOpen] = useState(false); const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement | null>(null);
  const showNotice = (message: string, kind: NoticeKind = "success") => setNotice({ message, kind });
  useEffect(() => {
    let active = true;
    void loadCode(projectId).then((result) => {
      if (!active) return;
      const mediaType = requestedType && ["image", "video", "audio", "file"].includes(requestedType) ? requestedType : null;
      setCode(result);
      setContent(mediaType && result.content.type === "text" ? emptyContent(mediaType) : result.content);
      setRender({ ...DEFAULT_QR_RENDER_CONFIG, ...result.render });
      setTitle(result.title);
    }).catch((error) => active && showNotice(error instanceof Error ? error.message : "加载活码失败", "error"));
    return () => { active = false; };
  }, [projectId, requestedType]);
  useEffect(() => {
    if (!previewOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    previewCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previewTriggerRef.current?.focus();
    };
  }, [previewOpen]);
  const payload = useMemo(() => buildPublicPayload(code?.slug ?? "TPQRDEMO01"), [code?.slug]);
  async function handleUpload(file: File, purpose?: string) { if (!code) throw new Error("活码尚未加载"); setUploading(true); try { const id = await uploadAsset(code.id, file, purpose ?? content.type); setContent((current) => ({ ...current, assetId: id } as ActiveContent)); setFieldErrors((current) => { const next = { ...current }; delete next["content.assetId"]; delete next.assetId; return next; }); showNotice("资源已上传，请保存草稿", "info"); return id; } catch (error) { showNotice(error instanceof Error ? error.message : "上传失败", "error"); throw error; } finally { setUploading(false); } }
  async function handleLogoUpload(file: File) {
    if (!code) throw new Error("活码尚未加载");
    setUploading(true);
    try {
      const id = await uploadAsset(code.id, file, "logo");
      setRender((current) => ({ ...current, logoAssetId: id, errorCorrectionLevel: "H" }));
      showNotice("中心 Logo 已上传，请保存样式", "info");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Logo 上传失败", "error");
    } finally {
      setUploading(false);
    }
  }
  function handleSaveError(error: unknown, fallback: string) {
    if (error instanceof ApiClientError && error.fieldErrors) setFieldErrors(error.fieldErrors);
    else setFieldErrors({});
    showNotice(error instanceof ApiClientError && error.code === "REVISION_CONFLICT" ? "内容已被其他窗口修改，请刷新后重试" : error instanceof Error ? error.message : fallback, "error");
  }
  async function saveDraft() { if (!code) return; setBusy(true); setFieldErrors({}); try { const updated = await saveCode(code.id, code.revision, { title, content, render }); setCode(updated); showNotice("草稿已保存", "success"); } catch (error) { handleSaveError(error, "保存失败"); } finally { setBusy(false); } }
  async function publish() {
    if (!code) return;
    const needsAsset = content.type === "image" || content.type === "video" || content.type === "audio" || content.type === "file";
    if (needsAsset && content.assetId.startsWith("00000000")) {
      setFieldErrors({ "content.assetId": [`请先上传${content.type === "file" ? "文件" : content.type === "image" ? "图片" : content.type === "video" ? "视频" : "音频"}，再发布二维码`] });
      showNotice("请先选择并上传内容文件", "error");
      return;
    }
    setBusy(true); setFieldErrors({}); try { const saved = await saveCode(code.id, code.revision, { title, content, render }); const published = await publishCode(code.id, saved.revision); setCode({ ...saved, status: "published", publishedVersionId: published.version.id, publishedVersion: published.version.version }); showNotice(`已发布 V${published.version.version}，新版本立即生效`, "success"); } catch (error) { handleSaveError(error, "发布失败"); } finally { setBusy(false); }
  }
  async function exportQr() { if (!code) return; setBusy(true); try { const blob = await qrBlob(payload, render, format); const result = await shareOrDownload(blob, `tp-qr-${code.slug}.${format}`); showNotice(result === "shared" ? "已打开系统分享" : `已下载 ${format.toUpperCase()} 文件`, "success"); } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) showNotice(error instanceof Error ? error.message : "下载失败", "error"); } finally { setBusy(false); } }
  const previewData = useMemo<PublicContentResponse | null>(() => {
    if (!code) return null;
    const assetIds = new Set<string>();
    if ("assetId" in content) assetIds.add(content.assetId);
    if (content.type === "video" && content.posterAssetId) assetIds.add(content.posterAssetId);
    if (content.type === "audio" && content.coverAssetId) assetIds.add(content.coverAssetId);
    return {
      code: { id: code.id, slug: code.slug, title, contentType: content.type, version: code.revision, publishedAt: code.updatedAt ?? new Date().toISOString(), content, render },
      assets: [...assetIds].filter((id) => !id.startsWith("00000000")).map((id) => ({ id, contentType: "application/octet-stream", size: 0, name: null, url: `/api/assets/${encodeURIComponent(id)}` })),
    };
  }, [code, content, render, title]);
  const isMobileShare = typeof window !== "undefined" && (window.matchMedia("(max-width: 768px)").matches || navigator.maxTouchPoints > 0);
  if (!code && !notice) return <ProjectShell><main className="qr-editor-loading"><Loader2 className="spin" />加载活码…</main></ProjectShell>;
  return <ProjectShell><main className="tp-qr-editor" style={{ backgroundImage: `linear-gradient(rgba(8, 11, 13, .94), rgba(8, 11, 13, .94)), url(${calibrationBackdrop})` }}>
    <div className="tp-qr-editor__workspace">
    <header className="tp-qr-editor__header"><div><span className="index-label">07 / ACTIVE QR</span><h1>活码工作台</h1><p>内容可更新，二维码保持不变。</p></div></header>
    {Object.keys(fieldErrors).length > 0 ? <div className="tp-field-errors" role="alert"><strong>请检查以下字段：</strong>{Object.entries(fieldErrors).map(([key, messages]) => <span key={key}>{key.replace(/^content\./, "")}：{messages.join("、")}</span>)}</div> : null}
    {code ? <div className="tp-qr-editor__grid"><section><label className="tp-title-field"><span>项目名称</span><input value={title} onChange={(e) => setTitle(e.target.value)} /><small>{fieldErrors.title?.[0]}</small></label><ContentEditor value={content} onChange={setContent} onUpload={handleUpload} uploading={uploading} fieldErrors={fieldErrors} /></section><section className="tp-qr-preview"><div className="tp-qr-paper"><QRCodeCanvas data={payload} render={render} /></div><span className="tp-status tp-status--teal"><i />{code.publishedVersionId ? "已发布" : "草稿"} · revision {code.revision}</span><code>{payload}</code><div className="tp-download-row"><select aria-label="下载格式" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option value="png">PNG</option><option value="svg">SVG</option><option value="webp">WEBP</option><option value="jpg">JPG</option></select><button type="button" className="button button--primary" disabled={busy} onClick={() => void exportQr()}>{isMobileShare ? <Share2 /> : <Download />}{isMobileShare ? "分享 / 下载" : "下载"}</button></div></section></div> : null}
    {code ? <aside className="tp-editor-side"><StylePanel render={render} onChange={setRender} onLogoUpload={handleLogoUpload} onClearLogo={() => setRender((current) => ({ ...current, logoAssetId: null }))} uploading={uploading} /><section className="tp-publish-panel" aria-label="发布证明"><header className="tp-publish-panel__header"><div><span className="index-label">03 / PUBLISH PROOF</span><h2>发布证明</h2></div><span className={`tp-publish-panel__state ${code.publishedVersionId ? "is-published" : "is-draft"}`}>{code.publishedVersionId ? "当前已发布" : "草稿未发布"}</span></header><dl className="tp-publish-panel__meta"><div><dt>当前 revision</dt><dd>{code.revision}</dd></div><div><dt>最近保存</dt><dd>{code.updatedAt ? new Date(code.updatedAt).toLocaleString("zh-CN") : "尚未保存"}</dd></div></dl><div className="tp-publish-panel__actions"><button type="button" className="button button--secondary" disabled={!code} onClick={(event) => { previewTriggerRef.current = event.currentTarget; setPreviewOpen(true); }}><Eye />预览</button><button type="button" className="button button--secondary" disabled={busy || !code} onClick={() => void saveDraft()}><Save />保存草稿</button><button type="button" className="button button--teal" disabled={busy || !code} onClick={() => void publish()}><Send />发布</button></div></section></aside> : null}
    {code && render.showFrame && render.frameText ? <div className="tp-qr-frame-preview" aria-label="边框说明预览"><span>{render.frameText}</span></div> : null}
    {code ? <section className="tp-version-track" aria-label="版本轨迹"><header><span>版本轨迹</span><span>{code.publishedVersion == null ? "尚未发布" : `V${code.publishedVersion}`}</span></header><div className="tp-version-track__line"><span className="is-done" /><i /><span className={code.publishedVersionId ? "is-published" : ""} /></div><div className="tp-version-track__labels"><span>草稿 revision {code.revision}</span><span>预览</span><span>{code.publishedVersion ? `已发布 V${code.publishedVersion}` : "待发布"}</span></div></section> : null}
    </div>
    {notice ? <p className={`tp-toast tp-toast--${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} aria-live="polite"><Check />{notice.message}</p> : null}
    {previewOpen && previewData ? <div className="tp-preview-modal" role="dialog" aria-modal="true" aria-label="草稿预览" onClick={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false); }}><div className="tp-preview-modal__surface"><button ref={previewCloseRef} type="button" className="tp-preview-modal__close" aria-label="关闭预览" onClick={() => setPreviewOpen(false)}><X size={20} aria-hidden="true" /><span>关闭预览</span></button><PublicContentFrame data={previewData} /></div></div> : null}
  </main></ProjectShell>;
}

const DOT_STYLE_OPTIONS: Array<{ value: QrRenderConfig["dotStyle"]; label: string }> = [
  { value: "rounded", label: "圆润" },
  { value: "square", label: "方块" },
  { value: "dots", label: "圆点" },
  { value: "classy", label: "经典" },
  { value: "classy-rounded", label: "经典圆角" },
  { value: "extra-rounded", label: "超圆角" },
];
const CORNER_STYLE_OPTIONS: Array<{ value: QrRenderConfig["cornerSquareStyle"]; label: string }> = [
  { value: "extra-rounded", label: "超圆角" },
  { value: "square", label: "方角" },
  { value: "dot", label: "圆点" },
];

function StylePanel({ render, onChange, onLogoUpload, onClearLogo, uploading }: { render: QrRenderConfig; onChange: (next: QrRenderConfig) => void; onLogoUpload: (file: File) => Promise<void>; onClearLogo: () => void; uploading: boolean }) {
  const update = <K extends keyof QrRenderConfig>(key: K, value: QrRenderConfig[K]) => onChange({ ...render, [key]: value });
  const setColor = (key: "foreground" | "background", value: string) => { if (/^#[0-9a-f]{6}$/i.test(value)) update(key, value.toUpperCase()); };
  return <details className="tp-style-panel" id="qr-style-panel" aria-label="二维码样式设置" open>
    <summary className="tp-style-panel__header"><div><span className="index-label">02 / VISUAL PARAMETERS</span><h2>视觉参数</h2></div><Palette size={20} aria-hidden="true" /></summary>
    <fieldset className="tp-style-group"><legend>码点</legend><div className="tp-style-options tp-style-options--dots">{DOT_STYLE_OPTIONS.map((option) => <button type="button" key={option.value} className={render.dotStyle === option.value ? "is-selected" : ""} aria-pressed={render.dotStyle === option.value} onClick={() => update("dotStyle", option.value)}><span className={`tp-style-swatch tp-style-swatch--${option.value}`} aria-hidden="true" />{option.label}</button>)}</div></fieldset>
    <fieldset className="tp-style-group"><legend>定位角</legend><div className="tp-style-options">{CORNER_STYLE_OPTIONS.map((option) => <button type="button" key={option.value} className={render.cornerSquareStyle === option.value ? "is-selected" : ""} aria-pressed={render.cornerSquareStyle === option.value} onClick={() => onChange({ ...render, cornerSquareStyle: option.value, cornerDotStyle: option.value === "dot" ? "dot" : option.value })}><span className={`tp-corner-swatch tp-corner-swatch--${option.value}`} aria-hidden="true" />{option.label}</button>)}</div></fieldset>
    <div className="tp-style-color-row"><label htmlFor="qr-foreground">前景色</label><div><input id="qr-foreground" aria-label="前景色" type="color" value={render.foreground} onChange={(event) => setColor("foreground", event.target.value)} /><input className="tp-color-hex" aria-label="前景色 Hex" value={render.foreground} maxLength={7} onChange={(event) => setColor("foreground", event.target.value)} /></div></div>
    <div className="tp-style-color-row"><label htmlFor="qr-background">背景色</label><div><input id="qr-background" aria-label="背景色" type="color" value={render.background} onChange={(event) => setColor("background", event.target.value)} /><input className="tp-color-hex" aria-label="背景色 Hex" value={render.background} maxLength={7} onChange={(event) => setColor("background", event.target.value)} /></div></div>
    <fieldset className="tp-style-group tp-style-group--logo"><legend>中心 Logo</legend><div className="tp-style-logo-row"><span className={`tp-style-state ${render.logoAssetId ? "is-active" : ""}`}>{render.logoAssetId ? "已启用" : "未添加"}</span><label className="tp-upload-button"><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void onLogoUpload(file); }} /><Upload size={15} />{uploading ? "上传中…" : render.logoAssetId ? "更换 Logo" : "上传 Logo"}</label></div>{render.logoAssetId ? <div className="tp-logo-controls"><label htmlFor="qr-logo-size">Logo 大小 <span className="tp-range-value">{render.logoSize ?? 56}px</span></label><input id="qr-logo-size" aria-label="Logo 大小" type="range" min="32" max="128" step="4" value={render.logoSize ?? 56} onChange={(event) => update("logoSize", Number(event.target.value))} /><button type="button" className="tp-text-button" onClick={onClearLogo}>移除 Logo</button></div> : <p className="tp-style-help">建议使用透明 PNG，上传后二维码会自动切换为高纠错级别。</p>}</fieldset>
    <fieldset className="tp-style-group"><legend>边框与说明</legend><label className="tp-style-check"><input type="checkbox" checked={Boolean(render.showFrame)} onChange={(event) => update("showFrame", event.target.checked)} /><span>显示边框说明</span></label><input className="tp-frame-input" aria-label="边框说明文字" disabled={!render.showFrame} maxLength={40} placeholder="例如：扫码打开内容" value={render.frameText ?? ""} onChange={(event) => update("frameText", event.target.value)} /></fieldset>
    <fieldset className="tp-style-group tp-style-group--compact"><label htmlFor="qr-error-correction">纠错级别</label><select id="qr-error-correction" aria-label="纠错级别" value={render.errorCorrectionLevel ?? "M"} onChange={(event) => update("errorCorrectionLevel", event.target.value as QrRenderConfig["errorCorrectionLevel"])}><option value="L">L · 低</option><option value="M">M · 标准</option><option value="Q">Q · 高</option><option value="H">H · 最高（推荐 Logo）</option></select></fieldset>
    <fieldset className="tp-style-group tp-style-group--sliders"><label htmlFor="qr-size">二维码尺寸 <span className="tp-range-value">{render.size}px</span></label><input id="qr-size" aria-label="二维码尺寸" type="range" min="256" max="1024" step="16" value={render.size} onChange={(event) => update("size", Number(event.target.value))} /><label htmlFor="qr-margin">安全边距 <span className="tp-range-value">{render.margin}px</span></label><input id="qr-margin" aria-label="安全边距" type="range" min="0" max="48" step="2" value={render.margin} onChange={(event) => update("margin", Number(event.target.value))} /></fieldset>
  </details>;
}

function QRCodeCanvas({ data, render }: { data: string; render: QrRenderConfig }) { const [url, setUrl] = useState<string>(""); useEffect(() => { let disposed = false; const qr = new QRCodeStyling(qrOptions(data, render, "canvas")); void qr.getRawData("png").then((blob) => { if (!disposed && blob) { const next = URL.createObjectURL(blob as Blob); setUrl((old) => { if (old) URL.revokeObjectURL(old); return next; }); } }); return () => { disposed = true; }; }, [data, render]); return url ? <img src={url} alt="活码二维码预览" width={render.size} height={render.size} /> : <div className="tp-qr-placeholder" aria-label="二维码生成中" />; }
