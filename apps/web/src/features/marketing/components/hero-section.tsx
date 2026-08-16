import { useId, useState } from "react";
import { ArrowRight, Contact, FileAudio, FileImage, FileText, FileVideo, Globe2, type LucideIcon, Type } from "lucide-react";
import { Link } from "react-router-dom";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { SiteHeader } from "./site-header";
import { ArchiveCard, CalibrationMark, StatusDot } from "./visual-primitives";

type ContentType = "image" | "video" | "audio" | "file" | "url" | "contact" | "text";
const contentTabs: Array<{ icon: LucideIcon; id: ContentType; label: string }> = [
  { id: "image", label: "图片", icon: FileImage },
  { id: "video", label: "视频", icon: FileVideo },
  { id: "audio", label: "音频", icon: FileAudio },
  { id: "file", label: "文件", icon: FileText },
  { id: "url", label: "网址", icon: Globe2 },
  { id: "contact", label: "名片", icon: Contact },
  { id: "text", label: "文字", icon: Type },
];

const defaultValues: Record<ContentType, string> = {
  image: "品牌手册.jpg", video: "产品介绍.mp4", audio: "品牌声音.mp3", file: "产品资料.pdf",
  url: "https://example.com/your-link", contact: "TP QR\nhello@example.com", text: "TP QR 让每一次扫码都指向最新内容。",
};
const fileTypes = new Set<ContentType>(["image", "video", "audio", "file"]);

export function HeroSection() {
  const [activeType, setActiveType] = useState<ContentType>("text");
  const [values, setValues] = useState(defaultValues);
  const inputId = useId();
  const qrData = values[activeType] || "TP QR";
  const activeLabel = contentTabs.find((tab) => tab.id === activeType)?.label ?? "内容";

  function handleFile(file: File | undefined) {
    if (!file) return;
    setValues((current) => ({ ...current, [activeType]: file.name }));
  }

  return (
    <section className="hero-section" id="product">
      <SiteHeader />
      <CalibrationMark className="hero-section__calibration" />
      <div className="live-generator paper-texture">
        <aside className="live-generator__meta">
          <p className="live-generator__title"><span>活码生成器</span> / LIVE</p>
          <dl>
            <div><dt>工作区</dt><dd>示例内容</dd></div>
            <div><dt>当前类型</dt><dd>{contentTabs.find((tab) => tab.id === activeType)?.label}</dd></div>
            <div><dt>状态</dt><dd><StatusDot tone="blue" />实时预览</dd></div>
          </dl>
        </aside>
        <div className="live-generator__editor">
          <div className="content-tabs" role="tablist" aria-label="活码内容类型">
            {contentTabs.map(({ id, label, icon: Icon }) => <button key={id} className={activeType === id ? "is-active" : ""} type="button" role="tab" aria-selected={activeType === id} onClick={() => setActiveType(id)}><Icon size={17} />{label}</button>)}
          </div>
          {fileTypes.has(activeType) ? (
            <label className="image-dropzone" htmlFor={inputId}>
              <FileImage size={28} />
              <span><strong>{values[activeType]}</strong>选择一个文件上传</span>
              <input id={inputId} type="file" accept={activeType === "image" ? "image/*" : activeType === "video" ? "video/*" : activeType === "audio" ? "audio/*" : undefined} onChange={(event) => handleFile(event.target.files?.[0])} />
            </label>
          ) : (
            <label className="live-generator__field" htmlFor={inputId}>
              <span className="sr-only">输入要生成的{activeLabel}</span>
              <textarea id={inputId} aria-label={`输入要生成的${activeLabel}`} value={values[activeType]} onChange={(event) => setValues((current) => ({ ...current, [activeType]: event.target.value }))} placeholder={activeType === "url" ? "https://example.com" : `输入${activeLabel}内容`} />
            </label>
          )}
        </div>
        <div className="live-generator__preview"><span>实时预览</span><QrSpecimen data={qrData} size={166} logo /></div>
        <Link className="live-generator__action" to="/login">开始创建活码 <ArrowRight aria-hidden="true" /></Link>
      </div>
      <div className="hero-narrative">
        <div className="hero-narrative__glyph" aria-hidden="true">QR</div>
        <div className="hero-narrative__versions">
          <ArchiveCard title="01 / 草稿内容" trailing="□"><dl><div><dt>内容版本</dt><dd>草稿</dd></div><div><dt>更新方式</dt><dd>随时编辑</dd></div><div><dt>修改者</dt><dd>你</dd></div></dl><p><StatusDot tone="blue" />保存后可预览</p></ArchiveCard>
          <span className="version-connector" aria-hidden="true"><ArrowRight /></span>
          <ArchiveCard title="02 / 发布结果" accent="red" trailing="□"><dl><div><dt>发布版本</dt><dd>不可变快照</dd></div><div><dt>访问方式</dt><dd>扫码或分享</dd></div><div><dt>状态</dt><dd>按需发布</dd></div></dl><p><StatusDot tone="teal" />发布后保持链接不变</p></ArchiveCard>
        </div>
        <div className="hero-narrative__copy"><h1>一个二维码，<br />内容随时更新</h1><p>图片、视频、音频、文件、网址、名片和文字，都能在同一个活码里持续更新。</p><div className="hero-narrative__actions"><Link className="button button--primary" to="/login">免费创建活码 <ArrowRight size={20} /></Link><a href="#templates">查看七类内容</a></div></div>
      </div>
    </section>
  );
}
