import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { ProjectShell } from "@client/components/layout/project-shell";
import { api } from "@client/lib/api";
import "./code-analytics.css";

type Point = { date: string; scans: number; views: number; clicks: number; downloads: number; plays: number };

export function CodeAnalyticsView() {
  const { projectId = "" } = useParams();
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([api.code(projectId), api.codeAnalytics(projectId)]).then(([code, analytics]) => {
      if (!active) return;
      setTitle(code.title);
      setPoints(analytics.items);
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "统计数据暂时无法读取"));
    return () => { active = false; };
  }, [projectId]);

  const totals = useMemo(() => points.reduce((sum, point) => ({ scans: sum.scans + point.scans, views: sum.views + point.views, clicks: sum.clicks + point.clicks, downloads: sum.downloads + point.downloads, plays: sum.plays + point.plays }), { scans: 0, views: 0, clicks: 0, downloads: 0, plays: 0 }), [points]);
  const maximum = Math.max(1, ...points.map((point) => point.scans));

  if (error) return <ProjectShell><main className="code-analytics paper-panel"><p className="public-error" role="alert">{error}</p></main></ProjectShell>;
  if (!title) return <ProjectShell><main className="route-loading" role="status"><Loader2 className="spin" />正在读取统计…</main></ProjectShell>;
  return <ProjectShell><main className="code-analytics paper-panel">
    <header className="code-analytics__header"><div><span className="index-label">TP QR / ANALYTICS</span><h1>{title}</h1><p>只统计已发布版本的匿名访问事件。</p></div><BarChart3 size={34} aria-hidden="true" /></header>
    <div className="code-analytics__cards">{[["扫码", totals.scans], ["查看", totals.views], ["点击", totals.clicks], ["下载", totals.downloads], ["播放", totals.plays]].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <section className="code-analytics__chart" aria-label="扫码趋势"><h2>最近 30 天扫码趋势</h2>{points.length ? <div className="code-analytics__bars">{points.map((point) => <div className="code-analytics__bar" key={point.date} title={`${point.date}: ${point.scans} 次扫码`}><i style={{ height: `${Math.max(3, (point.scans / maximum) * 100)}%` }} /><small>{point.date.slice(5)}</small></div>)}</div> : <p>还没有扫码数据，发布二维码后这里会自动更新。</p>}</section>
  </main></ProjectShell>;
}
