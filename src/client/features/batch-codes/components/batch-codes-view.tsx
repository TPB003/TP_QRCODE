import { useMemo, useState } from "react";
import JSZip from "jszip";
import Papa from "papaparse";
import QRCodeStyling from "qr-code-styling";
import { Check, Download, FileSpreadsheet, Filter, RefreshCw, Upload } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { ProjectShell } from "@client/components/layout/project-shell";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { api } from "@client/lib/api";
import "../batch-codes.css";

interface EntityRow {
  id: string;
  name: string;
  slug: string;
  status: "验证通过" | "字段不匹配";
}

export function BatchCodesView() {
  const { projectId = "" } = useParams();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState("未选择 CSV 文件");
  const [notice, setNotice] = useState("请先上传 CSV");
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<Array<Record<string, string>>>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [nameColumn, setNameColumn] = useState("");
  const [externalIdColumn, setExternalIdColumn] = useState("");
  const selectedRows = useMemo(() => entities.filter((entity) => selected.has(entity.id)), [entities, selected]);
  const previewEntity = selectedRows[0] ?? entities[0];

  useEffect(() => {
    void api.project(projectId).then(({ project, entities: loaded }) => {
      setPublishedVersionId(project.publishedVersionId);
      if (loaded.length > 0) {
        const mapped = loaded.map((entity) => ({ id: entity.id, name: entity.name, status: "验证通过" as const, slug: entity.slug }));
        setEntities(mapped);
        setSelected(new Set(mapped.map((entity) => entity.id)));
      }
    }).catch(() => setNotice("项目加载失败"));
  }, [projectId]);

  function handleCsv(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data.slice(0, 200);
        const headers = result.meta.fields ?? [];
        setParsedRows(rows);
        setCsvHeaders(headers);
        setNameColumn(headers.find((header) => /name|title|名称/i.test(header)) ?? headers[0] ?? "");
        setExternalIdColumn(headers.find((header) => /id|code|编号/i.test(header)) ?? headers[1] ?? headers[0] ?? "");
        setNotice(rows.length > 0 ? `已读取 ${rows.length} 条记录${result.data.length > 200 ? "（已按 200 条上限截取）" : ""}，请确认字段映射` : "CSV 中没有可导入记录");
      },
    });
  }

  function confirmMapping() {
    if (!nameColumn || parsedRows.length === 0) {
      setNotice("请选择实体名称字段");
      return;
    }
    void api.importEntities(projectId, parsedRows.map((row, index) => ({ name: row[nameColumn]?.trim() || `实体 ${index + 1}`, externalId: externalIdColumn ? row[externalIdColumn]?.trim() ?? "" : "", fields: Object.fromEntries(csvHeaders.filter((header) => header !== nameColumn && header !== externalIdColumn).map((header) => [header, row[header]?.trim() ?? ""])) }))).then((result) => {
      const next = result.items.map((entity) => ({ id: entity.id, name: entity.name, status: "验证通过" as const, slug: entity.slug }));
      setEntities(next);
      setSelected(new Set(next.map((entity) => entity.id)));
      setNotice(`已导入 ${result.count} 条实体`);
    }).catch((error) => setNotice(error instanceof Error ? error.message : "导入失败"));
  }

  async function downloadZip() {
    const zip = new JSZip();
    const csv = ["file_name,entity_id,entity_name,short_url", ...selectedRows.map((entity) => `${entity.slug}.png,${entity.id},${entity.name},${window.location.origin}/s/${entity.slug}`)].join("\n");
    zip.file("mapping.csv", csv);
    for (const entity of selectedRows) {
      const qr = new QRCodeStyling({ type: "canvas", width: 1024, height: 1024, data: `${window.location.origin}/s/${entity.slug}`, margin: 32, dotsOptions: { type: "rounded", color: "#2563EB" }, backgroundOptions: { color: "#FBF9F3" } });
      const blob = await qr.getRawData("png");
      if (blob instanceof Blob) zip.file(`${entity.id}.png`, blob);
    }
    zip.file("README.txt", "二维码由 TP QR 浏览器端按当前实体数据生成。\n");
    zip.file("version.json", JSON.stringify({ projectId, publishedVersionId, generatedAt: new Date().toISOString() }, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "tp-qr-batch.zip";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`已导出 ${selectedRows.length} 个实体映射`);
  }

  return (
    <ProjectShell>
      <section className="batch-codes-view">
        <header className="batch-heading"><h1>BATCH<br /><span>/200</span></h1><p>单次最多导入 200 个实体</p></header>
        <div className="batch-steps">
          <article className="batch-step-sheet"><header><b>1</b>上传 CSV</header><FileSpreadsheet /><strong>{fileName}</strong><small>128 KB</small><label><Upload />选择文件<input type="file" accept=".csv,text/csv" onChange={(event) => handleCsv(event.target.files?.[0])} /></label></article>
          <article className="batch-step-sheet"><header><b>2</b>字段映射</header><div className="mapping-list"><label>实体名称<select value={nameColumn} onChange={(event) => setNameColumn(event.target.value)} disabled={csvHeaders.length === 0}><option value="">请选择字段</option>{csvHeaders.map((header) => <option value={header} key={header}>{header}</option>)}</select></label><label>实体编号<select value={externalIdColumn} onChange={(event) => setExternalIdColumn(event.target.value)} disabled={csvHeaders.length === 0}><option value="">不导入编号</option>{csvHeaders.map((header) => <option value={header} key={header}>{header}</option>)}</select></label></div><button type="button" onClick={confirmMapping}>确认映射并导入</button></article>
          <article className="batch-step-sheet"><header><b>3</b>预览确认</header><div className="batch-preview-ticket">{previewEntity ? <><QrSpecimen data={`${window.location.origin}/s/${previewEntity.slug}`} size={118} /><p><strong>{previewEntity.name}</strong><code>{previewEntity.slug}</code></p></> : <p>导入实体后预览二维码</p>}</div><span className="batch-seal"><Check />{notice}</span><button type="button" onClick={() => setNotice(selectedRows.length > 0 ? "批量二维码已生成" : "请先选择实体")}>批量生成</button></article>
        </div>

        <div className="batch-table-sheet">
          <header><span>已选 {selected.size} 项</span><div><button type="button"><Filter />筛选</button><button type="button" onClick={() => setNotice("列表已刷新")}><RefreshCw />刷新</button></div></header>
          <div className="batch-table-row batch-table-head"><span>选择</span><span>实体名称</span><span>实体编号</span><span>二维码</span><span>状态</span><span>创建时间</span></div>
          {entities.map((entity) => (
            <div className={`batch-table-row ${entity.status === "字段不匹配" ? "is-error" : ""}`} key={entity.id}>
              <input type="checkbox" checked={selected.has(entity.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(entity.id); else next.delete(entity.id); return next; })} />
              <strong>{entity.name}</strong><code>{entity.id}</code><QrSpecimen data={`${window.location.origin}/s/${entity.slug}`} size={72} /><span><i />{entity.status}</span><time>{new Date().toLocaleString("zh-CN")}</time>
            </div>
          ))}
          <footer><span>ZIP 包含二维码文件、mapping.csv 与 version.json</span><button type="button" onClick={() => void downloadZip()}><Download />下载 ZIP</button></footer>
        </div>
      </section>
    </ProjectShell>
  );
}
