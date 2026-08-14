import { useEffect, useState, type ChangeEvent } from "react";
import { Check, Download, Eye, Image, Link2, Save, Send, Type } from "lucide-react";
import QRCodeStyling from "qr-code-styling";
import { useParams } from "react-router-dom";
import { ProjectShell } from "@client/components/layout/project-shell";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { api } from "@client/lib/api";
import type { ProjectDraft } from "@shared/types/domain";
import "../qr-editor.css";

const dotOptions = ["square", "rounded", "dots", "classy", "extra-rounded"] as const;
const finderOptions = ["square", "extra-rounded", "dot"] as const;

export function QrEditorView() {
  const { projectId = "" } = useParams();
  const [contentType, setContentType] = useState<"text" | "url" | "image">("url");
  const [content, setContent] = useState(() => `${window.location.origin}/s/inspection-demo`);
  const [dotType, setDotType] = useState<(typeof dotOptions)[number]>("rounded");
  const [finderType, setFinderType] = useState<(typeof finderOptions)[number]>("extra-rounded");
  const [foreground, setForeground] = useState("#2563eb");
  const [logo, setLogo] = useState(true);
  const [border, setBorder] = useState(true);
  const [notice, setNotice] = useState("草稿有修改");
  const [revision, setRevision] = useState(0);
  const [projectName, setProjectName] = useState("二维码项目");
  const [updatedAt, setUpdatedAt] = useState("");
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);
  const [storedContent, setStoredContent] = useState<ProjectDraft["content"] | null>(null);
  const [logoAssetId, setLogoAssetId] = useState<string | null>(null);
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [assetBusy, setAssetBusy] = useState(false);

  useEffect(() => {
    void api.project(projectId).then(({ project, entities }) => {
      setProjectName(project.name);
      setRevision(project.revision);
      setUpdatedAt(project.updatedAt);
      setPublishedVersionId(project.publishedVersionId);
      setStoredContent(project.content);
      if (project.content.type === "text" || project.content.type === "url") {
        setContentType(project.content.type);
        setContent(project.content.value);
      } else if (project.content.type === "image") {
        setContentType("image");
        setImageAssetId(project.content.assetId);
        setImagePreviewUrl(project.content.assetId ? `/api/assets/${project.content.assetId}` : "");
      } else if (project.content.type === "form" || project.content.type === "business") {
        setContent(`${window.location.origin}/s/${entities[0]?.slug ?? ""}`);
      }
      setForeground(project.visualStyle.foreground);
      setLogo(Boolean(project.visualStyle.logoAssetId));
      setLogoAssetId(project.visualStyle.logoAssetId);
    }).catch(() => setNotice("项目加载失败"));
  }, [projectId]);

  useEffect(() => () => {
    if (imagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  function currentContent(): ProjectDraft["content"] {
    if (storedContent?.type === "form" || storedContent?.type === "business") return storedContent;
    if (contentType === "text") return { type: "text", value: content };
    if (contentType === "image") return { type: "image", assetId: imageAssetId };
    return { type: "url", value: content.startsWith("http") ? content : "https://example.com" };
  }

  function qrData(): string {
    const next = currentContent();
    if (next.type === "image") return next.assetId ? `${window.location.origin}/api/public-assets/${next.assetId}` : "TP QR";
    return content || "TP QR";
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);
    setAssetBusy(true);
    setNotice("正在上传图片…");
    try {
      const asset = await api.uploadAsset(file, "image");
      setImageAssetId(asset.id);
      setNotice("图片已上传，请保存草稿后发布");
    } catch (error) {
      URL.revokeObjectURL(preview);
      setImagePreviewUrl("");
      setImageAssetId(null);
      setNotice(error instanceof Error ? error.message : "图片上传失败");
    } finally {
      setAssetBusy(false);
    }
  }

  function clearImage() {
    setImageAssetId(null);
    setImagePreviewUrl("");
    setNotice("图片已移除，请重新上传后发布");
  }

  async function saveDraft(): Promise<ProjectDraft | null> {
    try {
      const updated = await api.updateProject(projectId, revision, { content: currentContent(), visualStyle: { foreground, background: "#FBF9F3", dotStyle: dotType, cornerSquareStyle: finderType, cornerDotStyle: finderType, logoAssetId: logo ? logoAssetId : null, frameText: border ? "TP QR" : "" } });
      setRevision(updated.revision);
      setUpdatedAt(updated.updatedAt);
      setNotice("草稿已保存");
      return updated;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
      return null;
    }
  }

  async function publish() {
    try {
      const saved = await saveDraft();
      if (!saved) return;
      const result = await api.publishProject(projectId, saved.revision);
      setRevision(result.project.revision);
      setPublishedVersionId(result.project.publishedVersionId);
      setNotice("发布成功，新版本已生效");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "发布失败");
    }
  }

  async function download(extension: "png" | "svg") {
    const qr = new QRCodeStyling({ type: extension === "svg" ? "svg" : "canvas", width: 1024, height: 1024, data: qrData(), margin: 32, dotsOptions: { type: dotType, color: foreground }, cornersSquareOptions: { type: finderType, color: foreground }, backgroundOptions: { color: "#FBF9F3" } });
    await qr.download({ name: `${projectName.replaceAll(/\s+/g, "-")}-qr`, extension });
  }

  return (
    <ProjectShell>
      <section className="qr-editor-view">
        <div className="qr-editor-heading">
          <span>02 / 二维码编辑</span>
          <h1>QR VISUAL<br />WORKBENCH</h1>
          <p>二维码视觉工作台</p>
          <code>GRID = 21 × 21<br />ECC = Q (25%)<br />QUIET ZONE = 4</code>
        </div>

        <div className="qr-editor-tabs" role="tablist">
          <button type="button">内容</button><button className="is-active" type="button">样式</button><button type="button">发布</button>
        </div>

        <aside className="content-control paper-workbench-card">
          <header>01 / 内容变更</header>
          {[{ id: "text", label: "文本", icon: Type }, { id: "url", label: "网址", icon: Link2 }, { id: "image", label: "图片", icon: Image }].map(({ id, label, icon: Icon }) => (
            <button className={contentType === id ? "is-active" : ""} key={id} type="button" onClick={() => setContentType(id as typeof contentType)}><Icon />{label}<i /></button>
          ))}
          {contentType === "image" ? <div className="qr-image-upload"><span>图片附件</span>{imagePreviewUrl ? <figure><img src={imagePreviewUrl} alt="二维码图片附件预览" /><button type="button" onClick={clearImage}>移除图片</button></figure> : <p>上传一张图片后，二维码会指向发布后的公开图片地址。</p>}<label className="qr-image-upload__input"><span>{assetBusy ? "上传中…" : "选择 JPG / PNG / WebP"}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={assetBusy} onChange={handleImageUpload} /></label></div> : <label><span>内容预览</span><textarea value={content} onChange={(event) => { setContent(event.target.value); setNotice("草稿有修改"); }} /></label>}
        </aside>

        <div className={`qr-editor-canvas ${border ? "has-border" : ""}`}>
          <QrSpecimen data={qrData()} size={430} color={foreground} dotType={dotType} finderType={finderType} logo={logo} background="#fbf9f3" />
          <span className="canvas-target canvas-target--left" /><span className="canvas-target canvas-target--right" />
        </div>

        <aside className="visual-control paper-workbench-card">
          <header>02 / 视觉参数</header>
          <fieldset><legend>码点</legend><div>{dotOptions.map((option) => <button aria-label={`码点 ${option}`} className={dotType === option ? "is-active" : ""} key={option} type="button" onClick={() => setDotType(option)}><span className={`dot-icon dot-icon--${option}`} /></button>)}</div></fieldset>
          <fieldset><legend>定位角</legend><div>{finderOptions.map((option) => <button aria-label={`定位角 ${option}`} className={finderType === option ? "is-active" : ""} key={option} type="button" onClick={() => setFinderType(option)}><span className={`finder-icon finder-icon--${option}`} /></button>)}</div></fieldset>
          <label className="color-control"><span>前景色</span><input type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /><code>{foreground.toUpperCase()}</code></label>
          <label className="toggle-control"><span>中心 Logo</span><i className="mini-logo">TP</i><input type="checkbox" checked={logo} onChange={(event) => setLogo(event.target.checked)} /></label>
          <label className="toggle-control"><span>边框与说明</span><i>◩</i><input type="checkbox" checked={border} onChange={(event) => setBorder(event.target.checked)} /></label>
        </aside>

        <aside className="publish-control paper-workbench-card">
          <header>03 / 发布证据</header>
          <p className="draft-state">{notice}<strong>{updatedAt ? `最后修改：${new Date(updatedAt).toLocaleString("zh-CN")}` : "尚未读取项目状态"}</strong></p>
          <p className="published-state"><Check />{publishedVersionId ? "已有发布版本" : "尚未发布"}<strong>{publishedVersionId ? `版本 ID：${publishedVersionId.slice(0, 8)}` : "请先保存并发布"}</strong></p>
          <button className="publish-button" type="button" onClick={() => void publish()}>发布更新 <Send /></button>
          <div><button type="button" onClick={() => void saveDraft()}>保存草稿 <Save /></button><button type="button">预览 <Eye /></button></div>
          <span>下载资源</span>
          <div><button type="button" onClick={() => void download("png")}>PNG 1024px <Download /></button><button type="button" onClick={() => void download("svg")}>SVG <Download /></button></div>
        </aside>

        <div className="version-rail">
          <strong>版本轨迹</strong>
          <span className="is-draft">{notice}</span><i /><span>修订 r{revision}</span><i /><span>{publishedVersionId ? "公共页已更新" : "等待发布"}</span><i /><span className={publishedVersionId ? "is-published" : ""}>{publishedVersionId ? `版本 ${publishedVersionId.slice(0, 8)}` : "尚未发布"}</span>
        </div>
      </section>
    </ProjectShell>
  );
}
