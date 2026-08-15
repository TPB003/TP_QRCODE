import { useState } from "react";
import { Check, Copy, Download, ExternalLink, FileText, Share2 } from "lucide-react";
import type { PublicContentResponse } from "@tpqr/domain";
import { toVCard, validateSafeUrl } from "@tpqr/content";

type Props = { data: PublicContentResponse; onEvent?: (event: "view" | "click" | "download" | "play") => void };
function assetUrl(data: PublicContentResponse, id: string) { return data.assets.find((asset) => asset.id === id)?.url ?? `/api/public/${encodeURIComponent(data.code.slug)}/assets/${encodeURIComponent(id)}`; }
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function useCopy() { const [copied, setCopied] = useState(false); return { copied, copy: async (value: string) => { await navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); } }; }

export function PublicContentFrame({ data, onEvent }: Props) {
  const { code } = data; const content = code.content; const copy = useCopy(); const [error, setError] = useState("");
  const title = "title" in content && content.title ? content.title : code.title;
  const share = async () => { onEvent?.("click"); if (navigator.share) { try { await navigator.share({ title, url: window.location.href }); } catch { /* cancelled */ } } else await copy.copy(window.location.href); };
  const saveVCard = () => { const blob = new Blob([toVCard(content.type === "contact" ? content : {})], { type: "text/vcard;charset=utf-8" }); downloadBlob(blob, `${title || "contact"}.vcf`); onEvent?.("download"); };
  const body = (() => {
    if (content.type === "image") return <figure className="public-media"><img src={assetUrl(data, content.assetId)} alt={content.alt || title} onError={() => setError("图片加载失败")} /><figcaption>{content.alt || title}</figcaption></figure>;
    if (content.type === "video") return <div className="public-media"><video controls playsInline preload="metadata" poster={content.posterAssetId ? assetUrl(data, content.posterAssetId) : undefined} autoPlay={content.autoplay} loop={content.loop} onPlay={() => onEvent?.("play")} onError={() => setError("视频加载失败")}><source src={assetUrl(data, content.assetId)} /></video><p>{title}</p></div>;
    if (content.type === "audio") return <div className="public-audio"><div className="public-audio__cover">♪</div><h2>{title}</h2><p>{content.artist || "TP QR 音频"}</p><audio controls preload="metadata" onPlay={() => onEvent?.("play")} onError={() => setError("音频加载失败")}><source src={assetUrl(data, content.assetId)} /></audio></div>;
    if (content.type === "file") return <div className="public-file"><FileText size={44} /><div><h2>{title || content.downloadName}</h2><p>{content.description || "文件资源"}</p></div><a className="button button--primary" href={assetUrl(data, content.assetId)} download={content.downloadName} onClick={() => onEvent?.("download")}><Download />下载文件</a></div>;
    if (content.type === "url") { const safe = validateSafeUrl(content.url); return <div className="public-url"><p>{content.description}</p>{safe.ok ? <a className="button button--primary" href={safe.url?.toString()} target="_blank" rel="noopener noreferrer" onClick={() => onEvent?.("click")}><ExternalLink />安全打开</a> : <p className="public-error">该网址不安全或格式无效，已阻止跳转。</p>}</div>; }
    if (content.type === "contact") return <div className="public-contact"><div className="public-contact__avatar">{(content.firstName || content.organization || "名").slice(0, 1)}</div><h2>{[content.firstName, content.lastName].filter(Boolean).join(" ") || content.organization || "联系人"}</h2>{content.organization && <p>{content.organization}{content.title ? ` · ${content.title}` : ""}</p>}<dl>{content.phone && <><dt>电话</dt><dd><a href={`tel:${content.phone}`}>{content.phone}</a></dd></>}{content.email && <><dt>邮箱</dt><dd><a href={`mailto:${content.email}`}>{content.email}</a></dd></>}{content.website && <><dt>网站</dt><dd>{validateSafeUrl(content.website).ok ? content.website : "已隐藏不安全网址"}</dd></>}{content.address && <><dt>地址</dt><dd>{content.address}</dd></>}</dl><button type="button" className="button button--primary" onClick={saveVCard}><Download />保存名片</button></div>;
    return <div className="public-text"><h2>{title}</h2><p>{content.text}</p><button type="button" className="button button--secondary" onClick={() => void copy.copy(content.text)}>{copy.copied ? <Check /> : <Copy />}{copy.copied ? "已复制" : "复制文字"}</button></div>;
  })();
  return <main className="public-content-page"><article className="public-content-card"><header><span className="index-label">TP QR / PUBLIC</span><button type="button" aria-label="分享" onClick={() => void share()}><Share2 /></button></header><div className="public-content-card__title"><span className="tp-status tp-status--teal"><i />已发布</span><h1>{title}</h1></div>{error ? <p className="public-error" role="alert">{error}</p> : body}<footer><span>扫码访问 · 内容由创建者维护</span></footer></article></main>;
}
