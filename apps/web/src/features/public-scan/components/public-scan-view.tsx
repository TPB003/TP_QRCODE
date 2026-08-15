import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { PublicContentResponse } from "@tpqr/domain";
import { apiClient } from "@client/lib/api-client";
import { api } from "@client/lib/api";
import { PublicContentFrame } from "@client/features/public-content/public-content-frame";
import "@client/features/public-content/public-content.css";

export function PublicScanView() {
  const { slug = "" } = useParams(); const [data, setData] = useState<PublicContentResponse | null>(null); const [error, setError] = useState("");
  const sendEvent = (event: "view" | "click" | "download" | "play") => { void api.publicEvent(slug, event).catch(() => undefined); };
  useEffect(() => { let active = true; void apiClient.get<PublicContentResponse>(`/api/public/${encodeURIComponent(slug)}`).then((next) => active && setData(next)).catch((cause) => active && setError(cause instanceof Error ? cause.message : "此活码暂不可访问")); return () => { active = false; }; }, [slug]);
  if (error) return <main className="public-content-page"><article className="public-content-card"><span className="index-label">TP QR / 404</span><h1>页面暂不可用</h1><p className="public-error" role="alert">{error}</p><a className="button button--secondary" href="/">返回首页</a></article></main>;
  return data ? <PublicContentFrame data={data} onEvent={sendEvent} /> : <main className="public-content-page"><article className="public-content-card"><span className="index-label">TP QR / LOADING</span><h1>正在打开活码…</h1></article></main>;
}
