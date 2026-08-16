import { useState } from "react";
import { Check, Copy, Download, ExternalLink, FileText, Share2 } from "lucide-react";
import type { PublicContentResponse } from "@tpqr/domain";
import { toVCard, validateSafeUrl } from "@tpqr/content";
import "./public-content-overrides.css";

type Props = { data: PublicContentResponse; onEvent?: (event: "view" | "click" | "download" | "play") => void };
function assetUrl(data: PublicContentResponse, id: string) { return data.assets.find((asset) => asset.id === id)?.url ?? `/api/public/${encodeURIComponent(data.code.slug)}/assets/${encodeURIComponent(id)}`; }
function assetDownloadUrl(data: PublicContentResponse, id: string) {
  const url = assetUrl(data, id);
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Clipboard permissions are commonly unavailable in embedded and non-HTTPS contexts.
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let copied: boolean;
  try { copied = document.execCommand("copy"); } catch { copied = false; }
  textarea.remove();
  return copied;
}
function useCopy() {
  const [state, setState] = useState<"idle" | "success" | "error">("idle");
  return {
    copied: state === "success",
    failed: state === "error",
    copy: async (value: string) => {
      const copied = await copyText(value);
      setState(copied ? "success" : "error");
      window.setTimeout(() => setState("idle"), 2200);
      return copied;
    },
  };
}

export function PublicContentFrame({ data, onEvent }: Props) {
  const { code } = data; const content = code.content; const copy = useCopy(); const [error, setError] = useState(""); const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const title = "title" in content && content.title ? content.title : code.title;
  const share = async () => {
    onEvent?.("click");
    if (navigator.share) {
      try { await navigator.share({ title, url: window.location.href }); } catch { /* user cancelled the native sheet */ }
    } else {
      await copy.copy(window.location.href);
    }
  };
  const saveVCard = () => { const blob = new Blob([toVCard(content.type === "contact" ? content : {})], { type: "text/vcard;charset=utf-8" }); downloadBlob(blob, `${title || "contact"}.vcf`); onEvent?.("download"); };
  const body = (() => {
    if (content.type === "image") return <figure className="public-media"><button type="button" className="public-media__image-button" onClick={() => setExpandedImage(assetUrl(data, content.assetId))} aria-label="放大图片"><img src={assetUrl(data, content.assetId)} alt={content.alt || title} onError={() => setError("图片加载失败")} /></button><figcaption>{content.alt || title}</figcaption><div className="public-media__actions"><button type="button" className="button button--secondary" onClick={() => setExpandedImage(assetUrl(data, content.assetId))}>查看大图</button><a className="button button--primary" href={assetDownloadUrl(data, content.assetId)} download={`${title || "tp-qr-image"}.jpg`} onClick={() => onEvent?.("download")}><Download />保存图片</a></div></figure>;
    if (content.type === "video") return <div className="public-media"><video controls playsInline preload="metadata" poster={content.posterAssetId ? assetUrl(data, content.posterAssetId) : undefined} autoPlay={content.autoplay} loop={content.loop} onPlay={() => onEvent?.("play")} onError={() => setError("视频加载失败")}><source src={assetUrl(data, content.assetId)} /></video><p>{title}</p><a className="button button--secondary" href={assetDownloadUrl(data, content.assetId)} download={`${title || "tp-qr-video"}.mp4`} onClick={() => onEvent?.("download")}><Download />下载视频</a></div>;
    if (content.type === "audio") return <div className="public-audio"><div className="public-audio__cover">♪</div><h2>{title}</h2><p>{content.artist || "TP QR 音频"}</p><audio controls preload="metadata" onPlay={() => onEvent?.("play")} onError={() => setError("音频加载失败")}><source src={assetUrl(data, content.assetId)} /></audio><a className="button button--secondary" href={assetDownloadUrl(data, content.assetId)} download={`${title || "tp-qr-audio"}.mp3`} onClick={() => onEvent?.("download")}><Download />下载音频</a></div>;
    if (content.type === "file") return <div className="public-file"><FileText size={44} /><div><h2>{title || content.downloadName}</h2><p>{content.description || "文件资源"}</p></div><a className="button button--primary" href={assetDownloadUrl(data, content.assetId)} download={content.downloadName} onClick={() => onEvent?.("download")}><Download />下载文件</a></div>;
    if (content.type === "url") { const safe = validateSafeUrl(content.url); return <div className="public-url"><p>{content.description}</p>{safe.ok ? <a className="button button--primary" href={safe.url?.toString()} target="_blank" rel="noopener noreferrer" onClick={() => onEvent?.("click")}><ExternalLink />安全打开</a> : <p className="public-error">该网址不安全或格式无效，已阻止跳转。</p>}</div>; }
    if (content.type === "contact") return <div className="public-contact"><div className="public-contact__avatar">{(content.firstName || content.organization || "名").slice(0, 1)}</div><h2>{[content.firstName, content.lastName].filter(Boolean).join(" ") || content.organization || "联系人"}</h2>{content.organization && <p>{content.organization}{content.title ? ` · ${content.title}` : ""}</p>}<dl>{content.phone && <><dt>电话</dt><dd><a href={`tel:${content.phone}`}>{content.phone}</a></dd></>}{content.email && <><dt>邮箱</dt><dd><a href={`mailto:${content.email}`}>{content.email}</a></dd></>}{content.website && <><dt>网站</dt><dd>{validateSafeUrl(content.website).ok ? content.website : "已隐藏不安全网址"}</dd></>}{content.address && <><dt>地址</dt><dd>{content.address}</dd></>}</dl><button type="button" className="button button--primary" onClick={saveVCard}><Download />保存名片</button></div>;
    return <div className="public-text"><p>{content.text}</p><button type="button" className="button button--secondary" onClick={() => void copy.copy(content.text)}>{copy.copied ? <Check /> : <Copy />}{copy.copied ? "已复制" : "复制文字"}</button>{copy.failed ? <p className="public-error" role="alert">复制失败，请手动选择文字复制。</p> : null}</div>;
  })();
  return <main className="public-content-page"><article className="public-content-card"><header><span className="index-label">TP QR / PUBLIC</span><div className="public-content-card__header-actions"><button type="button" aria-label="分享" onClick={() => void share()}><Share2 /></button>{copy.copied ? <span className="public-copy-status" role="status"><Check />已复制链接</span> : copy.failed ? <span className="public-copy-status public-copy-status--error" role="status">复制失败</span> : null}</div></header><div className="public-content-card__title"><span className="tp-status tp-status--teal"><i />已发布</span><h1>{title}</h1></div>{error ? <p className="public-error" role="alert">{error}</p> : body}<footer><span>扫码访问 · 内容由创建者维护</span></footer></article>{expandedImage ? <div className="public-lightbox" role="dialog" aria-modal="true" aria-label="图片预览" onClick={() => setExpandedImage(null)}><button type="button" aria-label="关闭图片预览" onClick={() => setExpandedImage(null)}>关闭</button><img src={expandedImage} alt={title} onClick={(event) => event.stopPropagation()} /></div> : null}</main>;
}
