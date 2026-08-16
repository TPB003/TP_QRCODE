import { useState } from "react";
import { Check, Copy, Download, ExternalLink, FileText, Share2 } from "lucide-react";
import type { ActiveContent, PublicContentResponse } from "@tpqr/domain";
import { toVCard, validateSafeUrl } from "@tpqr/content";
import "./public-content-overrides.css";

type PublicEvent = "view" | "click" | "download" | "play";
type Props = { data: PublicContentResponse; onEvent?: (event: PublicEvent) => void };

function assetUrl(data: PublicContentResponse, id: string) {
  return data.assets.find((asset) => asset.id === id)?.url ?? `/api/public/${encodeURIComponent(data.code.slug)}/assets/${encodeURIComponent(id)}`;
}

function assetMeta(data: PublicContentResponse, id: string) {
  return data.assets.find((asset) => asset.id === id);
}

function assetDownloadUrl(data: PublicContentResponse, id: string) {
  const url = assetUrl(data, id);
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback for embedded and restricted contexts.
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

function contentTitle(content: ActiveContent): string {
  if ("title" in content && content.title.trim()) return content.title.trim();
  if (content.type === "file" && content.downloadName.trim()) return content.downloadName.trim();
  if (content.type === "contact") return [content.firstName, content.lastName].filter(Boolean).join(" ").trim() || content.organization.trim();
  return "";
}

export function PublicContentFrame({ data, onEvent }: Props) {
  const { code } = data;
  const content = code.content;
  const copy = useCopy();
  const [error, setError] = useState("");
  const imageOnly = content.type === "image";
  const title = imageOnly ? "" : contentTitle(content) || code.title;
  const pageClass = `public-content-page public-content-page--${content.type}`;
  const cardClass = `public-content-card public-content-card--${content.type}`;

  const share = async () => {
    onEvent?.("click");
    if (navigator.share) {
      try { await navigator.share({ title: title || "TP QR 内容", url: window.location.href }); } catch { /* cancellation is not an error */ }
    } else {
      const copied = await copy.copy(window.location.href);
      if (copied) onEvent?.("click");
    }
  };

  const saveVCard = () => {
    const blob = new Blob([toVCard(content.type === "contact" ? content : {})], { type: "text/vcard;charset=utf-8" });
    downloadBlob(blob, `${title || "contact"}.vcf`);
    onEvent?.("download");
  };

  const body = (() => {
    if (content.type === "image") {
      const url = assetUrl(data, content.assetId);
      return <figure className="public-media public-media--image-only" aria-label="图片内容">
        <img className="public-image-only" src={url} alt={content.alt || "图片内容"} onError={() => setError("图片加载失败")} />
      </figure>;
    }
    if (content.type === "video") return <div className="public-media">
      <video controls playsInline preload="metadata" poster={content.posterAssetId ? assetUrl(data, content.posterAssetId) : undefined} autoPlay={content.autoplay} loop={content.loop} onPlay={() => onEvent?.("play")} onError={() => setError("视频加载失败")}><source src={assetUrl(data, content.assetId)} /></video>
      {title ? <p className="public-media__label">{title}</p> : null}
      <a className="button button--secondary" href={assetDownloadUrl(data, content.assetId)} download="tp-qr-video.mp4" onClick={() => onEvent?.("download")}><Download />下载视频</a>
    </div>;
    if (content.type === "audio") return <div className="public-audio">
      <div className="public-audio__cover" aria-hidden="true">♫</div>
      {title ? <h2>{title}</h2> : null}
      {content.artist ? <p>{content.artist}</p> : null}
      <audio controls preload="metadata" onPlay={() => onEvent?.("play")} onError={() => setError("音频加载失败")}><source src={assetUrl(data, content.assetId)} /></audio>
      <a className="button button--secondary" href={assetDownloadUrl(data, content.assetId)} download="tp-qr-audio.mp3" onClick={() => onEvent?.("download")}><Download />下载音频</a>
    </div>;
    if (content.type === "file") {
      const meta = assetMeta(data, content.assetId);
      return <div className="public-file"><FileText size={44} aria-hidden="true" /><div><h2>{title}</h2><p>{meta?.contentType ?? "文件"} · {meta ? `${Math.max(1, Math.round(meta.size / 1024))} KB` : ""}</p>{content.description ? <p>{content.description}</p> : null}</div><a className="button button--primary" href={assetDownloadUrl(data, content.assetId)} download={content.downloadName} onClick={() => onEvent?.("download")}><Download />下载文件</a></div>;
    }
    if (content.type === "url") {
      const safe = validateSafeUrl(content.url);
      return <div className="public-url">{content.description ? <p>{content.description}</p> : null}<p className="public-url__host">{safe.ok ? new URL(content.url).hostname : "无效网址"}</p>{safe.ok ? <a className="button button--primary" href={safe.url?.toString()} target="_blank" rel="noopener noreferrer" onClick={() => onEvent?.("click")}><ExternalLink />安全打开</a> : <p className="public-error">该网址不安全或格式无效，已阻止跳转。</p>}</div>;
    }
    if (content.type === "contact") return <div className="public-contact">
      <div className="public-contact__avatar" aria-hidden="true">{(content.firstName || content.organization || "联").slice(0, 1)}</div>
      {title ? <h2>{title}</h2> : null}
      {content.organization && content.title ? <p>{content.organization} · {content.title}</p> : content.organization ? <p>{content.organization}</p> : null}
      <dl>{content.phone && <><dt>电话</dt><dd><a href={`tel:${content.phone}`}>{content.phone}</a></dd></>}{content.email && <><dt>邮箱</dt><dd><a href={`mailto:${content.email}`}>{content.email}</a></dd></>}{content.website && <><dt>网站</dt><dd>{validateSafeUrl(content.website).ok ? content.website : "已隐藏不安全网址"}</dd></>}{content.address && <><dt>地址</dt><dd>{content.address}</dd></>}</dl>
      <button type="button" className="button button--primary" onClick={saveVCard}><Download />保存名片</button>
    </div>;
    return <div className="public-text"><p>{content.text}</p><button type="button" className="button button--secondary" onClick={() => void copy.copy(content.text)}>{copy.copied ? <Check /> : <Copy />}{copy.copied ? "已复制" : "复制文字"}</button>{copy.failed ? <p className="public-error" role="alert">复制失败，请手动选择文字复制。</p> : null}</div>;
  })();

  return <main className={pageClass} data-content-type={content.type}>
    <article className={cardClass}>
      {!imageOnly ? <header className="public-content-card__toolbar"><span className="public-content-card__type">{content.type.toUpperCase()}</span><div className="public-content-card__header-actions"><button type="button" aria-label="分享" onClick={() => void share()}><Share2 /></button>{copy.copied ? <span className="public-copy-status" role="status"><Check />已复制链接</span> : copy.failed ? <span className="public-copy-status public-copy-status--error" role="status">复制失败</span> : null}</div></header> : null}
      {!imageOnly && title ? <div className="public-content-card__title"><h1>{title}</h1></div> : null}
      {error ? <p className="public-error" role="alert">{error}</p> : body}
    </article>
  </main>;
}
