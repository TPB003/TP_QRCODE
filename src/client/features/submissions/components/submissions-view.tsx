import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useParams } from "react-router-dom";
import { ProjectShell } from "@client/components/layout/project-shell";
import { api, type SubmissionDetailResponse } from "@client/lib/api";
import "../submissions.css";

interface DisplayRow {
  id: string;
  device: string;
  submitter: string;
  result: string;
  attachments: number;
  submittedAt: string;
}

function displayValue(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : fallback;
}

function fieldValue(values: Record<string, unknown>, labels: Record<string, string>, candidates: string[], fallback: string): string {
  const fieldId = Object.entries(labels).find(([, label]) => candidates.includes(label))?.[0];
  const candidateValue = fieldId ? values[fieldId] : candidates.map((candidate) => values[candidate]).find((value) => value !== undefined);
  return displayValue(Array.isArray(candidateValue) ? candidateValue.join("、") : candidateValue, fallback);
}

function points(values: number[], height: number): string {
  if (values.length < 2) return `0,${height} 850,${height}`;
  const maximum = Math.max(...values, 1);
  return values.map((value, index) => `${(index / (values.length - 1)) * 850},${height - (value / maximum) * height}`).join(" ");
}

export function SubmissionsView() {
  const { projectId = "" } = useParams();
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [scanValues, setScanValues] = useState<number[]>([0, 0]);
  const [submissionValues, setSubmissionValues] = useState<number[]>([0, 0]);
  const [activeId, setActiveId] = useState("");
  const [activeDetail, setActiveDetail] = useState<SubmissionDetailResponse | null>(null);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("全部");

  useEffect(() => {
    let active = true;
    void Promise.all([api.project(projectId), api.submissions(projectId), api.analytics(projectId)]).then(([projectResult, submissionResult, analytics]) => {
      if (!active) return;
      const schema = projectResult.project.content.type === "form" || projectResult.project.content.type === "business" ? projectResult.project.content.schema : null;
      const labels = Object.fromEntries(schema?.fields.map((field) => [field.id, field.label]) ?? []);
      setFieldLabels(labels);
      const mapped = submissionResult.items.map((row) => ({
        id: row.id,
        device: fieldValue(row.values, labels, ["设备名称", "deviceName"], "未命名设备"),
        submitter: fieldValue(row.values, labels, ["巡检人", "inspector", "姓名", "name"], "匿名提交"),
        result: fieldValue(row.values, labels, ["巡检结果", "result"], "已提交"),
        attachments: row.attachments,
        submittedAt: row.createdAt,
      }));
      setRows(mapped);
      setActiveId(mapped[0]?.id ?? "");
      setScanValues(analytics.items.map((item) => item.scans));
      setSubmissionValues(analytics.items.map((item) => item.submissions));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!activeId) return;
    let active = true;
    void api.submission(projectId, activeId).then((detail) => {
      if (active) setActiveDetail(detail);
    }).catch(() => {
      if (active) setActiveDetail(null);
    });
    return () => { active = false; };
  }, [activeId, projectId]);

  const visibleRows = useMemo(() => rows.filter((row) => (resultFilter === "全部" || row.result === resultFilter) && `${row.device}${row.submitter}`.includes(query)), [query, resultFilter, rows]);
  const active = rows.find((row) => row.id === activeId) ?? visibleRows[0];

  function moveSelection(direction: number) {
    if (!active) return;
    const index = rows.findIndex((row) => row.id === active.id);
    const next = rows[Math.min(rows.length - 1, Math.max(0, index + direction))];
    if (next) setActiveId(next.id);
  }

  return (
    <ProjectShell>
      <section className="submissions-view">
        <aside className="submissions-index"><h1>EVIDENCE<br />LOG</h1><p>TP QR<br />EVIDENCE DESK</p><strong>SECTION<br /><b>10</b> / 11</strong></aside>
        <div className="submissions-main">
          <div className="submission-tabs"><button className="is-active" type="button">提交记录</button><button type="button">扫码统计</button></div>
          <div className="submission-chart paper-evidence-sheet"><header><span>扫码次数</span><span>提交数量</span></header><svg viewBox="0 0 850 220" role="img" aria-label="扫码次数与提交数量趋势"><polyline className="scan-line" points={points(scanValues, 200)} /><polyline className="submission-line" points={points(submissionValues, 200)} /></svg></div>
          <div className="submission-filters"><select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}><option>全部</option><option>运行正常</option><option>发现异常</option></select><select><option>最近 30 天</option></select><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索设备或提交人" /></label><button type="button" onClick={() => { window.location.href = `/api/projects/${projectId}/submissions/export`; }}><Download />导出 CSV</button><button type="button" onClick={() => moveSelection(-1)}>上一条</button><button type="button" onClick={() => moveSelection(1)}>下一条</button></div>
          <div className="submission-records"><div className="submission-record submission-record--head"><span>设备</span><span>提交人</span><span>巡检结果</span><span>附件</span><span>提交时间</span></div>{visibleRows.map((row) => <button className={`submission-record ${row.id === activeId ? "is-active" : ""} ${row.result === "发现异常" ? "is-error" : ""}`} type="button" key={row.id} onClick={() => setActiveId(row.id)}><strong>{row.device}</strong><span>{row.submitter}</span><span><i />{row.result}</span><span>{row.attachments}</span><time>{new Date(row.submittedAt).toLocaleString("zh-CN")}</time></button>)}{visibleRows.length === 0 ? <p className="submission-empty">暂无符合条件的提交记录</p> : null}</div>
        </div>
        <aside className="submission-detail paper-evidence-sheet"><h2>提交详情</h2>{active ? <>{activeDetail?.id !== active.id ? <p>正在加载提交详情…</p> : <><dl><div><dt>设备</dt><dd>{active.device}</dd></div><div><dt>巡检结果</dt><dd className={active.result === "发现异常" ? "is-error" : ""}>{active.result}</dd></div><div><dt>附件</dt><dd>{activeDetail.attachments.length}</dd></div><div><dt>提交人</dt><dd>{active.submitter}</dd></div><div><dt>提交时间</dt><dd>{new Date(active.submittedAt).toLocaleString("zh-CN")}</dd></div></dl><section className="submission-detail-values"><h3>表单内容</h3>{Object.entries(activeDetail.values).map(([key, value]) => <div key={key}><span>{fieldLabels[key] ?? key}</span><strong>{displayValue(Array.isArray(value) ? value.join("、") : value, "未填写")}</strong></div>)}</section><section className="submission-attachments"><h3>现场图片</h3>{activeDetail.attachments.length ? <div>{activeDetail.attachments.map((attachment, index) => <img key={attachment.id} src={attachment.url} alt={`现场附件 ${index + 1}`} loading="lazy" />)}</div> : <p>未上传图片</p>}</section></>}</> : <p>选择一条提交记录查看详情。</p>}</aside>
      </section>
    </ProjectShell>
  );
}
