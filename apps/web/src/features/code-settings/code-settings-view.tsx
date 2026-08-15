import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ProjectShell } from "@client/components/layout/project-shell";
import { api, type CodeSummary } from "@client/lib/api";
import "./code-settings.css";

export function CodeSettingsView() {
  const { projectId = "" } = useParams(); const navigate = useNavigate();
  const [code, setCode] = useState<CodeSummary | null>(null); const [title, setTitle] = useState(""); const [status, setStatus] = useState<"active" | "paused">("active"); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; void api.code(projectId).then((result) => { if (!active) return; setCode(result); setTitle(result.title); setStatus(result.status === "paused" ? "paused" : "active"); }).catch((cause) => active && setNotice(cause instanceof Error ? cause.message : "活码不存在")); return () => { active = false; }; }, [projectId]);
  async function save() { if (!code) return; setBusy(true); try { const updated = await api.updateCode(code.id, code.revision, { title: title.trim() || "未命名活码", status }); setCode(updated); setTitle(updated.title); setNotice("设置已保存"); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "保存失败"); } finally { setBusy(false); } }
  async function remove() { if (!code || !window.confirm("删除后会保留 30 天，确定继续吗？")) return; setBusy(true); try { await apiClientDelete(code.id); void navigate("/app"); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "删除失败"); } finally { setBusy(false); } }
  if (!code) return <ProjectShell><main className="route-loading" role="status">{notice || "正在读取活码设置…"}</main></ProjectShell>;
  return <ProjectShell><main className="code-settings paper-panel"><header><span className="index-label">TP QR / SETTINGS</span><h1>活码设置</h1><p>单独管理这张二维码的名称、发布状态和公共地址。</p></header><label>活码名称<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label><label>访问状态<select value={status} onChange={(event) => setStatus(event.target.value as "active" | "paused")}><option value="active">正常访问</option><option value="paused">暂停访问</option></select></label><label>公共地址<input readOnly value={`${window.location.origin}/s/${code.slug}`} /></label><div className="code-settings__meta"><span>内容类型：{code.contentType}</span><span>当前 revision：{code.revision}</span></div><div className="code-settings__actions"><button className="button button--primary" type="button" disabled={busy} onClick={() => void save()}><Save />保存设置</button><button className="button button--secondary code-settings__delete" type="button" disabled={busy} onClick={() => void remove()}><Trash2 />删除活码</button></div>{notice ? <p className="tp-toast tp-toast--success" role="status">{notice}</p> : null}</main></ProjectShell>;
}

async function apiClientDelete(codeId: string) {
  const response = await fetch(`/api/codes/${encodeURIComponent(codeId)}`, { method: "DELETE", credentials: "include" });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(typeof body === "object" && body !== null && "error" in body ? String((body as { error: { message?: string } }).error.message ?? "删除失败") : "删除失败");
}
