import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { ProjectShell } from "@client/components/layout/project-shell";
import { api } from "@client/lib/api";
import "./code-versions.css";

export function CodeVersionsView() {
  const { projectId = "" } = useParams();
  const [title, setTitle] = useState("");
  const [versions, setVersions] = useState<Array<{ id: string; version: number; revision: number; content: { type: string }; publishedAt: string }>>([]);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; void Promise.all([api.code(projectId), api.codeVersions(projectId)]).then(([code, result]) => { if (!active) return; setTitle(code.title); setVersions(result.items); }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "版本记录暂时无法读取")); return () => { active = false; }; }, [projectId]);
  if (error) return <ProjectShell><main className="code-versions paper-panel"><p className="public-error" role="alert">{error}</p></main></ProjectShell>;
  if (!title) return <ProjectShell><main className="route-loading" role="status"><Loader2 className="spin" />正在读取版本…</main></ProjectShell>;
  return <ProjectShell><main className="code-versions paper-panel"><header><div><span className="index-label">TP QR / VERSIONS</span><h1>{title}</h1><p>每次发布都会生成不可变版本，公共二维码只读取最新已发布版本。</p></div><History size={34} aria-hidden="true" /></header><div className="code-versions__list">{versions.length ? versions.map((version) => <article key={version.id}><strong>V{version.version}</strong><span>{version.content.type}</span><small>revision {version.revision} · {new Date(version.publishedAt).toLocaleString("zh-CN")}</small></article>) : <p>还没有发布版本。保存草稿后点击发布即可创建版本。</p>}</div></main></ProjectShell>;
}
