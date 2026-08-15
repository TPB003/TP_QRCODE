import { useId, useState } from "react";
import { ArrowRight, FileImage, Globe2, Type } from "lucide-react";
import { Link } from "react-router-dom";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { SiteHeader } from "./site-header";
import { ArchiveCard, CalibrationMark, StatusDot } from "./visual-primitives";

type ContentType = "text" | "url" | "image";

const contentTabs: Array<{ icon: typeof Type; id: ContentType; label: string }> = [
  { id: "text", label: "文本", icon: Type },
  { id: "url", label: "网址", icon: Globe2 },
  { id: "image", label: "图片", icon: FileImage },
];

const defaultValues: Record<Exclude<ContentType, "image">, string> = {
  text: "TP QR 让每一次扫码都指向最新内容。",
  url: "/s/demo",
};

export function HeroSection() {
  const [activeType, setActiveType] = useState<ContentType>("text");
  const [values, setValues] = useState(defaultValues);
  const [imageName, setImageName] = useState("设备巡检说明.jpg");
  const inputId = useId();
  const qrData = activeType === "image" ? `/assets/${encodeURIComponent(imageName)}` : values[activeType];

  return (
    <section className="hero-section" id="product">
      <SiteHeader />
      <CalibrationMark className="hero-section__calibration" />

      <div className="live-generator paper-texture">
        <aside className="live-generator__meta">
          <p className="live-generator__title"><span>生成器</span> / LIVE</p>
          <dl>
            <div><dt>会话 ID</dt><dd>QR-20260810-A9F7</dd></div>
            <div><dt>创建时间</dt><dd>2026-08-10 14:28</dd></div>
            <div><dt>状态</dt><dd><StatusDot tone="blue" />草稿已保存</dd></div>
          </dl>
        </aside>

        <div className="live-generator__editor">
          <div className="content-tabs" role="tablist" aria-label="二维码内容类型">
            {contentTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={activeType === id ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={activeType === id}
                onClick={() => setActiveType(id)}
              >
                <Icon size={17} />{label}
              </button>
            ))}
          </div>
          {activeType === "image" ? (
            <label className="image-dropzone" htmlFor={inputId}>
              <FileImage size={28} />
              <span><strong>{imageName}</strong>选择一张云端展示图片</span>
              <input
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setImageName(event.target.files?.[0]?.name ?? imageName)}
              />
            </label>
          ) : (
            <label className="live-generator__field" htmlFor={inputId}>
              <span className="sr-only">输入要生成的{activeType === "text" ? "文本" : "网址"}</span>
              <textarea
                id={inputId}
                aria-label={activeType === "text" ? "输入要生成的文本" : "输入要生成的网址"}
                value={values[activeType]}
                onChange={(event) => setValues((current) => ({ ...current, [activeType]: event.target.value }))}
                placeholder={activeType === "text" ? "输入要生成的内容" : "https://example.com"}
              />
            </label>
          )}
        </div>

        <div className="live-generator__preview">
          <span>实时预览</span>
          <QrSpecimen data={qrData || "TP QR"} size={166} logo />
        </div>

        <Link className="live-generator__action" to="/login">
          生成二维码 <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <div className="hero-narrative">
        <div className="hero-narrative__glyph" aria-hidden="true">QR</div>
        <div className="hero-narrative__versions">
          <ArchiveCard title="01 / 草稿内容" trailing="□">
            <dl>
              <div><dt>内容版本</dt><dd>v3.2.1</dd></div>
              <div><dt>最后修改</dt><dd>14:21</dd></div>
              <div><dt>修改者</dt><dd>你</dd></div>
            </dl>
            <p><StatusDot tone="blue" />草稿已保存</p>
          </ArchiveCard>
          <span className="version-connector" aria-hidden="true"><ArrowRight /></span>
          <ArchiveCard title="02 / 发布结果" accent="red" trailing="□">
            <dl>
              <div><dt>发布版本</dt><dd>v1.0.0</dd></div>
              <div><dt>发布时间</dt><dd>14:28</dd></div>
              <div><dt>状态</dt><dd>正常</dd></div>
            </dl>
            <p><StatusDot tone="teal" />当前已发布</p>
          </ArchiveCard>
        </div>
        <div className="hero-narrative__copy">
          <h1>一个二维码，<br />内容随时更新</h1>
          <p>草稿可以反复修改，发布后同一个二维码立即指向新内容。</p>
          <div className="hero-narrative__actions">
            <Link className="button button--primary" to="/login">免费创建二维码 <ArrowRight size={20} /></Link>
            <a href="#templates">查看业务模板</a>
          </div>
        </div>
      </div>
    </section>
  );
}
