import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileAudio, FileImage, FileText, FileVideo, Globe2, Plus, QrCode, Search, UserRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "@client/components/layout/app-shell";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { api } from "@client/lib/api";
import type { CodeSummary } from "@client/lib/api";
import type { ActiveContent, ActiveContentType } from "@tpqr/domain";
import { emptyContent } from "@client/features/content-editor/content-editor-model";
import "../dashboard.css";
import "../dashboard-overrides.css";

type CodeType = ActiveContentType;
type Filter = "全部" | "已发布" | "草稿" | "已暂停";

const contentTypeOptions: Array<{ type: CodeType; label: string; icon: typeof FileText }> = [
  { type: "image", label: "图片", icon: FileImage },
  { type: "video", label: "视频", icon: FileVideo },
  { type: "audio", label: "音频", icon: FileAudio },
  { type: "file", label: "文件", icon: FileText },
  { type: "url", label: "网址", icon: Globe2 },
  { type: "contact", label: "名片", icon: UserRound },
  { type: "text", label: "文字", icon: FileText },
];

const typeLabels = Object.fromEntries(contentTypeOptions.map(({ type, label }) => [type, label])) as Record<CodeType, string>;

function trendPoints(values: number[]): string {
  if (values.length < 2) return "0,210 560,210";
  const maximum = Math.max(...values, 1);
  return values.map((value, index) => `${(index / (values.length - 1)) * 560},${210 - (value / maximum) * 180}`).join(" ");
}

function initialContent(type: CodeType): ActiveContent {
  if (type === "url") return { type, url: `${window.location.origin}/`, title: "", description: "" };
  if (type === "contact") return { type, firstName: "", lastName: "", organization: "TP QR", title: "", phone: "", email: "", website: "", address: "", note: "" };
  if (type === "text") return { type, title: "", text: "在编辑器中完善这张活码的内容。" };
  // Keep the requested type in the code record; the editor replaces the placeholder asset after upload.
  return { ...emptyContent(type), title: `新的${typeLabels[type]}活码` };
}

async function readAnalytics(codeId: string): Promise<number[]> {
  try {
    const response = await fetch(`/api/codes/${encodeURIComponent(codeId)}/analytics?days=30`, { credentials: "include" });
    if (!response.ok) return [];
    const body: { data?: { items?: Array<{ scans?: number }> } } = await response.json();
    return body.data?.items?.map((item) => Number(item.scans ?? 0)) ?? [];
  } catch {
    return [];
  }
}

export function DashboardView() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") === "analytics" ? "analytics" : searchParams.get("view") === "codes" ? "codes" : "overview";
  const [filter, setFilter] = useState<Filter>("全部");
  const [search, setSearch] = useState("");
  const [codes, setCodes] = useState<CodeSummary[]>([]);
  const [trend, setTrend] = useState<number[]>([0, 0]);
  const [scanTotals, setScanTotals] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [createNotice, setCreateNotice] = useState("");
  const [newName, setNewName] = useState("新建活码");
  const [newType, setNewType] = useState<CodeType>("text");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void api.codes().then(async (result) => {
      if (!active) return;
      setCodes(result.items);
      const analytics = await Promise.all(result.items.map(async (code) => ({ code, points: await readAnalytics(code.id) })));
      if (!active) return;
      const totals: Record<string, number> = {};
      const values: number[] = [];
      analytics.forEach(({ code, points }) => { totals[code.id] = points.reduce((sum, value) => sum + value, 0); points.forEach((value, index) => { values[index] = (values[index] ?? 0) + value; }); });
      setScanTotals(totals);
      setTrend(values.length > 1 ? values : [0, 0]);
    }).catch(() => { if (active) void navigate("/login"); });
    return () => { active = false; };
  }, [navigate]);

  const visibleCodes = useMemo(() => codes.filter((code) => {
    const status = code.publishedVersionId ? "已发布" : code.status === "paused" ? "已暂停" : "草稿";
    return (filter === "全部" || filter === status) && code.title.toLowerCase().includes(search.trim().toLowerCase());
  }), [codes, filter, search]);

  async function createCode() {
    try {
      setCreateNotice("");
      const code = await api.createCode(newName.trim() || "新建活码", initialContent(newType));
      setCodes((current) => [code, ...current]);
      setCreating(false);
      const requestedType = newType === "text" || newType === "url" || newType === "contact" ? "" : `?type=${newType}`;
      await navigate(`/app/codes/${code.id}/qr${requestedType}`);
    } catch (error) {
      setCreateNotice(error instanceof Error ? error.message : "创建活码失败，请稍后重试");
    }
  }

  return <AppShell>
    <section className="dashboard-view">
      <div className="dashboard-view__heading">
        <h1>{view === "analytics" ? <>SCAN<br />DATA</> : view === "codes" ? <>MY<br />CODES</> : <>ACTIVE<br />CODES</>}</h1>
        <div className="dashboard-view__actions">
          <button type="button" onClick={() => setCreating(true)}><Plus />新建活码</button>
          <Link className="dashboard-decoder-link" to="/decoder"><QrCode />解码二维码</Link>
          <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索活码" aria-label="搜索活码" /></label>
          <div className="dashboard-filters" aria-label="活码状态筛选">
            {(["全部", "已发布", "草稿", "已暂停"] as Filter[]).map((item) => <button className={filter === item ? "is-active" : ""} key={item} type="button" onClick={() => setFilter(item)}>{item}</button>)}
          </div>
        </div>
      </div>

      {view !== "codes" ? <article className="dashboard-trend paper-panel">
        <header><h2>最近 30 天</h2><span>活码扫描次数</span></header>
        <svg viewBox="0 0 560 230" role="img" aria-label="最近 30 天扫描趋势">{[0, 1, 2, 3].map((lineIndex) => <line key={lineIndex} x1="0" x2="560" y1={lineIndex * 65 + 15} y2={lineIndex * 65 + 15} />)}<polyline points={trendPoints(trend)} /></svg>
      </article> : null}

      {view === "analytics" ? <article className="dashboard-analytics paper-panel" aria-label="扫码统计明细"><header><h2>按活码统计</h2><span>最近 30 天累计</span></header>{visibleCodes.map((code) => <div className="dashboard-analytics__row" key={code.id}><span>{code.title}</span><strong>{scanTotals[code.id] ?? 0}</strong><small>次扫码</small></div>)}{visibleCodes.length === 0 ? <p className="dashboard-table__empty">暂无统计数据</p> : null}</article> : null}

      <div className="dashboard-table paper-panel">
        <div className="dashboard-table__row dashboard-table__head"><span>活码</span><span>类型</span><span>状态</span><span>最近更新</span><span>扫码次数</span></div>
        {visibleCodes.map((code) => {
          const status = code.publishedVersionId ? "已发布" : code.status === "paused" ? "已暂停" : "草稿";
          return <Link className="dashboard-table__row" to={`/app/codes/${code.id}/qr`} key={code.id}><span><QrSpecimen data={`${window.location.origin}/s/${code.slug}`} size={72} />{code.title}</span><span>{typeLabels[code.contentType] ?? "活码"}</span><span><i className={`project-status project-status--${status}`}>{status}</i></span><time>{new Date(code.updatedAt).toLocaleString("zh-CN")}</time><strong>{scanTotals[code.id] ?? 0}</strong></Link>;
        })}
        {visibleCodes.length === 0 ? <p className="dashboard-table__empty">暂无符合条件的活码</p> : null}
      </div>

      <aside className="recent-submissions paper-panel"><h2>最近编辑</h2>{codes.slice(0, 5).map((code, index) => <Link to={`/app/codes/${code.id}/qr`} key={code.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{code.title}</strong><small>{new Date(code.updatedAt).toLocaleString("zh-CN")}</small><ArrowRight /></Link>)}</aside>

      {creating ? <div className="dashboard-create paper-panel" role="dialog" aria-modal="true" aria-labelledby="create-code-title"><h2 id="create-code-title">新建活码</h2>{createNotice ? <p role="alert">{createNotice}</p> : null}<label>活码名称<input value={newName} onChange={(event) => setNewName(event.target.value)} autoFocus /></label><label>内容类型<select value={newType} onChange={(event) => setNewType(event.target.value as CodeType)}>{contentTypeOptions.map(({ type, label }) => <option value={type} key={type}>{label}</option>)}</select></label><p className="dashboard-create__hint">图片、视频、音频和文件可在下一步上传，草稿不会写入虚假资源。</p><div><button type="button" onClick={() => setCreating(false)}>取消</button><button type="button" onClick={() => void createCode()}>创建并编辑</button></div></div> : null}
    </section>
  </AppShell>;
}
