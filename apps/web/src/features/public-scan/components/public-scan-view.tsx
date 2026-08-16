import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { PublicContentResponse } from "@tpqr/domain";
import { api } from "@client/lib/api";
import { PublicContentFrame } from "@client/features/public-content/public-content-frame";
import "@client/features/public-content/public-content.css";

async function loadPublicCode(slug: string, idempotencyKey: string): Promise<PublicContentResponse> {
  const response = await fetch(`/api/public/${encodeURIComponent(slug)}`, {
    headers: { "X-Idempotency-Key": idempotencyKey },
    credentials: "include",
  });
  const body: unknown = await response.json();
  if (!response.ok || typeof body !== "object" || body === null || !("data" in body)) {
    const error = typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string" ? body.error.message : "此活码暂不可访问";
    throw new Error(error);
  }
  return body.data as PublicContentResponse;
}

export function PublicScanView() {
  const { slug = "" } = useParams(); const [data, setData] = useState<PublicContentResponse | null>(null); const [error, setError] = useState("");
  const sendEvent = (event: "view" | "click" | "download" | "play") => { void api.publicEvent(slug, event).catch(() => undefined); };
  useEffect(() => {
    let active = true;
    const scanKey = crypto.randomUUID();
    void loadPublicCode(slug, scanKey).then((next) => {
      if (!active) return;
      setData(next);
      const viewKey = crypto.randomUUID();
      void api.publicEvent(slug, "view", viewKey).catch(() => undefined);
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "此活码暂不可访问"));
    return () => { active = false; };
  }, [slug]);
  if (error) return <main className="public-content-page"><article className="public-content-card"><span className="index-label">TP QR / 404</span><h1>页面暂不可用</h1><p className="public-error" role="alert">{error}</p><a className="button button--secondary" href="/">返回首页</a></article></main>;
  return data ? <PublicContentFrame data={data} onEvent={sendEvent} /> : <main className="public-content-page public-content-page--loading" aria-busy="true" aria-label="正在加载内容" />;
}
