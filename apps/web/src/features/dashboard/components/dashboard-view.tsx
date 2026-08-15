import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus, QrCode, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "@client/components/layout/app-shell";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { api } from "@client/lib/api";
import { TEMPLATE_KEYS, TEMPLATE_LABELS } from "@shared/constants/product";
import type { ProjectDraft } from "@shared/types/domain";
import "../dashboard.css";

function trendPoints(values: number[]): string {
  if (values.length < 2) return "0,210 560,210";
  const maximum = Math.max(...values, 1);
  return values.map((value, index) => `${(index / (values.length - 1)) * 560},${210 - (value / maximum) * 180}`).join(" ");
}

export function DashboardView() {
  const [filter, setFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<ProjectDraft[]>([]);
  const [trend, setTrend] = useState<number[]>([0, 0]);
  const [scanTotals, setScanTotals] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [createNotice, setCreateNotice] = useState("");
  const [newName, setNewName] = useState("新建二维码项目");
  const [newKind, setNewKind] = useState<ProjectDraft["kind"]>("text");
  const [templateKey, setTemplateKey] = useState<(typeof TEMPLATE_KEYS)[number]>("collection");
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    void api.projects().then(async (result) => {
      if (!active) return;
      setProjects(result.items);
      const analytics = await Promise.allSettled(result.items.map((project) => api.analytics(project.id)));
      if (!active) return;
      const totals: Record<string, number> = {};
      const byDate = new Map<string, number>();
      analytics.forEach((entry, index) => {
        if (entry.status !== "fulfilled") return;
        totals[result.items[index].id] = entry.value.items.reduce((sum, item) => sum + item.scans, 0);
        entry.value.items.forEach((item) => byDate.set(item.date, (byDate.get(item.date) ?? 0) + item.scans));
      });
      setScanTotals(totals);
      const points = [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
      setTrend(points.length > 1 ? points : [0, 0]);
    }).catch(() => { if (active) void navigate("/login"); });
    return () => { active = false; };
  }, [navigate]);
  const visibleProjects = useMemo(
    () => projects.filter((project) => (filter === "全部" || (filter === "已发布" ? Boolean(project.publishedVersionId) : filter === "草稿" ? !project.publishedVersionId : project.status === "paused")) && project.name.includes(search)),
    [filter, projects, search],
  );

  const statusLabel = (project: ProjectDraft) => project.publishedVersionId ? "已发布" : project.status === "paused" ? "已暂停" : "草稿";
  const kindLabel = (project: ProjectDraft) => ({ text: "文字", url: "网址", image: "图片", video: "视频", audio: "音频", file: "文件", contact: "名片", form: "文字", business: "活码" } as Record<string, string>)[project.kind] ?? "活码";

  async function createProject() {
    try {
      setCreateNotice("");
      const result = await api.createProject(newName, newKind, newKind === "business" || newKind === "form" ? templateKey : undefined);
      setProjects((current) => [result.project, ...current]);
      setCreating(false);
      await navigate(`/app/projects/${result.project.id}/qr`);
    } catch (error) {
      setCreateNotice(error instanceof Error ? error.message : "创建项目失败，请稍后重试");
    }
  }

  return (
    <AppShell>
      <section className="dashboard-view">
        <div className="dashboard-view__heading">
          <h1>ACTIVE<br />CODES</h1>
          <div className="dashboard-view__actions">
            <button type="button" onClick={() => setCreating(true)}><Plus />新建活码</button>
            <Link className="dashboard-decoder-link" to="/decoder"><QrCode />解码二维码</Link>
            <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索项目" /></label>
            <div className="dashboard-filters">
              {["全部", "已发布", "草稿", "已暂停"].map((item) => <button className={filter === item ? "is-active" : ""} key={item} type="button" onClick={() => setFilter(item)}>{item}</button>)}
            </div>
          </div>
        </div>

        <article className="dashboard-trend paper-panel">
          <header><h2>最近 30 天</h2><span>活码扫描次数</span></header>
          <svg viewBox="0 0 560 230" role="img" aria-label="最近 30 天扫描趋势">
            {[0, 1, 2, 3].map((lineIndex) => <line key={lineIndex} x1="0" x2="560" y1={lineIndex * 65 + 15} y2={lineIndex * 65 + 15} />)}
            <polyline points={trendPoints(trend)} />
          </svg>
        </article>

        <div className="dashboard-table paper-panel">
          <div className="dashboard-table__row dashboard-table__head"><span>项目</span><span>类型</span><span>状态</span><span>最近更新</span><span>扫码次数</span></div>
          {visibleProjects.map((project) => (
            <Link className="dashboard-table__row" to={`/app/projects/${project.id}/qr`} key={project.id}>
              <span><QrSpecimen data={`${window.location.origin}/app/projects/${project.id}`} size={72} />{project.name}</span>
              <span>{kindLabel(project)}</span>
              <span><i className={`project-status project-status--${statusLabel(project)}`}>{statusLabel(project)}</i></span>
              <time>{new Date(project.updatedAt).toLocaleString("zh-CN")}</time>
              <strong>{scanTotals[project.id] ?? 0}</strong>
            </Link>
          ))}
          {visibleProjects.length === 0 ? <p className="dashboard-table__empty">没有符合条件的项目</p> : null}
        </div>

        <aside className="recent-submissions paper-panel">
          <h2>最近提交</h2>
          {projects.slice(0, 5).map((project, index) => <Link to={`/app/projects/${project.id}/submissions`} key={project.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{project.name}</strong><small>{new Date(project.updatedAt).toLocaleString("zh-CN")}</small><ArrowRight /></Link>)}
        </aside>
        {creating ? <div className="dashboard-create paper-panel"><h2>新建项目</h2>{createNotice ? <p role="alert">{createNotice}</p> : null}<label>项目名称<input value={newName} onChange={(event) => setNewName(event.target.value)} /></label><label>项目类型<select value={newKind} onChange={(event) => setNewKind(event.target.value as ProjectDraft["kind"])}><option value="business">业务模板</option><option value="form">空白表单</option><option value="text">文本</option><option value="url">网址</option><option value="image">图片</option></select></label>{newKind === "business" || newKind === "form" ? <label>业务模板<select value={templateKey} onChange={(event) => setTemplateKey(event.target.value as (typeof TEMPLATE_KEYS)[number])}>{TEMPLATE_KEYS.map((key) => <option value={key} key={key}>{TEMPLATE_LABELS[key]}</option>)}</select></label> : null}<div><button type="button" onClick={() => setCreating(false)}>取消</button><button type="button" onClick={() => void createProject()}>创建项目</button></div></div> : null}
      </section>
    </AppShell>
  );
}
