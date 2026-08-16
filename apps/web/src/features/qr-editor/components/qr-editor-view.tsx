import { useEffect, useMemo, useState } from "react";
import { Check, Download, Eye, Loader2, Save, Send, Share2 } from "lucide-react";
import QRCodeStyling from "qr-code-styling";
import { useParams, useSearchParams } from "react-router-dom";
import type { ActiveContent, PublicContentResponse, QrRenderConfig } from "@tpqr/domain";
import { buildPublicPayload, DEFAULT_QR_RENDER_CONFIG } from "@tpqr/qr";
import { ProjectShell } from "@client/components/layout/project-shell";
import { ApiClientError, apiClient } from "@client/lib/api-client";
import { ContentEditor } from "@client/features/content-editor/content-editor";
import { emptyContent } from "@client/features/content-editor/content-editor-model";
import { PublicContentFrame } from "@client/features/public-content/public-content-frame";
import "../qr-editor.css";
import "../qr-editor-overrides.css";

type Code = { id: string; slug: string; title: string; contentType: ActiveContent["type"]; status: "active" | "draft" | "published" | "paused" | "deleted"; revision: number; content: ActiveContent; render: QrRenderConfig; publishedVersionId?: string | null; updatedAt?: string };
type CodeResponse = Code;

async function uploadAsset(codeId: string, file: File, purpose: string) { const form = new FormData(); form.set("file", file); form.set("purpose", purpose); const result = await apiClient.post<{ id: string }>(`/api/codes/${encodeURIComponent(codeId)}/assets`, form); return result.id; }
async function loadCode(id: string) { return apiClient.get<CodeResponse>(`/api/codes/${encodeURIComponent(id)}`); }
async function saveCode(id: string, revision: number, body: { content: ActiveContent; render: QrRenderConfig; title: string }) { return apiClient.patch<Code>(`/api/codes/${encodeURIComponent(id)}`, { ...body, revision }); }
async function publishCode(id: string, revision: number) { return apiClient.post<{ codeId: string; slug: string; version: { id: string; version: number; revision: number; publishedAt: string } }>(`/api/codes/${encodeURIComponent(id)}/publish`, { revision }); }

async function qrBlob(data: string, render: QrRenderConfig, format: "png" | "svg" | "webp" | "jpg"): Promise<Blob> {
  const qr = new QRCodeStyling({ type: format === "svg" ? "svg" : "canvas", width: render.size, height: render.size, data, margin: render.margin, dotsOptions: { type: render.dotStyle, color: render.foreground }, cornersSquareOptions: { type: render.cornerSquareStyle, color: render.foreground }, cornersDotOptions: { type: render.cornerDotStyle, color: render.foreground }, backgroundOptions: { color: render.background }, qrOptions: { errorCorrectionLevel: render.errorCorrectionLevel } });
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
  const [code, setCode] = useState<Code | null>(null); const [content, setContent] = useState<ActiveContent>(emptyContent("text")); const [render, setRender] = useState<QrRenderConfig>(DEFAULT_QR_RENDER_CONFIG); const [title, setTitle] = useState("我的活码"); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [format, setFormat] = useState<"png" | "svg" | "webp" | "jpg">("png"); const [previewOpen, setPreviewOpen] = useState(false); const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  useEffect(() => {
    let active = true;
    void loadCode(projectId).then((result) => {
      if (!active) return;
      const mediaType = requestedType && ["image", "video", "audio", "file"].includes(requestedType) ? requestedType : null;
      setCode(result);
      setContent(mediaType && result.content.type === "text" ? emptyContent(mediaType) : result.content);
      setRender({ ...DEFAULT_QR_RENDER_CONFIG, ...result.render });
      setTitle(result.title);
    }).catch((error) => active && setNotice(error instanceof Error ? error.message : "加载活码失败"));
    return () => { active = false; };
  }, [projectId, requestedType]);
  const payload = useMemo(() => buildPublicPayload(code?.slug ?? "TPQRDEMO01"), [code?.slug]);
  async function handleUpload(file: File, purpose?: string) { if (!code) throw new Error("活码尚未加载"); setUploading(true); try { const id = await uploadAsset(code.id, file, purpose ?? content.type); setContent((current) => ({ ...current, assetId: id } as ActiveContent)); setNotice("资源已上传，请保存草稿"); return id; } catch (error) { setNotice(error instanceof Error ? error.message : "上传失败"); throw error; } finally { setUploading(false); } }
  function handleSaveError(error: unknown, fallback: string) {
    if (error instanceof ApiClientError && error.fieldErrors) setFieldErrors(error.fieldErrors);
    else setFieldErrors({});
    setNotice(error instanceof ApiClientError && error.code === "REVISION_CONFLICT" ? "内容已被其他窗口修改，请刷新后重试" : error instanceof Error ? error.message : fallback);
  }
  async function saveDraft() { if (!code) return; setBusy(true); setFieldErrors({}); try { const updated = await saveCode(code.id, code.revision, { title, content, render }); setCode(updated); setNotice("草稿已保存"); } catch (error) { handleSaveError(error, "保存失败"); } finally { setBusy(false); } }
  async function publish() { if (!code) return; setBusy(true); setFieldErrors({}); try { const saved = await saveCode(code.id, code.revision, { title, content, render }); const published = await publishCode(code.id, saved.revision); setCode({ ...saved, status: "published", publishedVersionId: published.version.id }); setNotice("已发布，新版本立即生效"); } catch (error) { handleSaveError(error, "发布失败"); } finally { setBusy(false); } }
  async function exportQr() { if (!code) return; setBusy(true); try { const blob = await qrBlob(payload, render, format); const result = await shareOrDownload(blob, `tp-qr-${code.slug}.${format}`); setNotice(result === "shared" ? "已打开系统分享" : `已下载 ${format.toUpperCase()} 文件`); } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setNotice(error instanceof Error ? error.message : "下载失败"); } finally { setBusy(false); } }
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
  return <ProjectShell><main className="tp-qr-editor">
    <header className="tp-qr-editor__header"><div><span className="index-label">07 / ACTIVE QR</span><h1>活码工作台</h1><p>内容可更新，二维码保持不变。</p></div><div className="tp-qr-editor__actions"><button type="button" className="button button--secondary" disabled={!code} onClick={() => setPreviewOpen(true)}><Eye />预览</button><button type="button" className="button button--secondary" disabled={busy || !code} onClick={() => void saveDraft()}><Save />保存草稿</button><button type="button" className="button button--teal" disabled={busy || !code} onClick={() => void publish()}><Send />发布</button></div></header>
    {Object.keys(fieldErrors).length > 0 ? <div className="tp-field-errors" role="alert"><strong>请检查以下字段：</strong>{Object.entries(fieldErrors).map(([key, messages]) => <span key={key}>{key.replace(/^content\./, "")}：{messages.join("、")}</span>)}</div> : null}
    {code ? <div className="tp-qr-editor__grid"><section><label className="tp-title-field"><span>项目名称</span><input value={title} onChange={(e) => setTitle(e.target.value)} /><small>{fieldErrors.title?.[0]}</small></label><ContentEditor value={content} onChange={setContent} onUpload={handleUpload} uploading={uploading} fieldErrors={fieldErrors} /></section><section className="tp-qr-preview"><div className="tp-qr-paper"><QRCodeCanvas data={payload} render={render} /></div><span className="tp-status tp-status--teal"><i />{code.publishedVersionId ? "已发布" : "草稿"} · revision {code.revision}</span><code>{payload}</code><div className="tp-download-row"><select aria-label="下载格式" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option value="png">PNG</option><option value="svg">SVG</option><option value="webp">WEBP</option><option value="jpg">JPG</option></select><button type="button" className="button button--primary" disabled={busy} onClick={() => void exportQr()}>{isMobileShare ? <Share2 /> : <Download />}{isMobileShare ? "分享 / 下载" : "下载"}</button></div></section></div> : null}
    {notice ? <p className="tp-toast tp-toast--success" role="status"><Check />{notice}</p> : null}
    {previewOpen && previewData ? <div className="tp-preview-modal" role="dialog" aria-modal="true" aria-label="草稿预览"><button type="button" className="tp-preview-modal__close button button--secondary" onClick={() => setPreviewOpen(false)}>关闭预览</button><PublicContentFrame data={previewData} /></div> : null}
  </main></ProjectShell>;
}

function QRCodeCanvas({ data, render }: { data: string; render: QrRenderConfig }) { const [url, setUrl] = useState<string>(""); useEffect(() => { let disposed = false; const qr = new QRCodeStyling({ type: "canvas", width: render.size, height: render.size, data, margin: render.margin, dotsOptions: { type: render.dotStyle, color: render.foreground }, cornersSquareOptions: { type: render.cornerSquareStyle, color: render.foreground }, cornersDotOptions: { type: render.cornerDotStyle, color: render.foreground }, backgroundOptions: { color: render.background } }); void qr.getRawData("png").then((blob) => { if (!disposed && blob) { const next = URL.createObjectURL(blob as Blob); setUrl((old) => { if (old) URL.revokeObjectURL(old); return next; }); } }); return () => { disposed = true; }; }, [data, render]); return url ? <img src={url} alt="活码二维码预览" width={render.size} height={render.size} /> : <div className="tp-qr-placeholder" aria-label="二维码生成中" />; }
