import { useState } from "react";
import { ArrowRight, Check, Image, Link2, Type } from "lucide-react";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { marketingQrStyles } from "../model/marketing-data";
import { CalibrationMark } from "./visual-primitives";

const contentTypes = [
  { id: "text", label: "文本", icon: Type },
  { id: "url", label: "网址", icon: Link2 },
  { id: "image", label: "图片", icon: Image },
] as const;

export function StylesSection() {
  const [activeContent, setActiveContent] = useState<(typeof contentTypes)[number]["id"]>("text");
  const [selectedStyle, setSelectedStyle] = useState(0);

  return (
    <section className="styles-section paper-texture" id="styles">
      <div className="styles-section__rail" aria-hidden="true">03 / STYLE INDEX</div>
      <div className="styles-section__content">
        <CalibrationMark className="styles-section__mark" />
        <div className="styles-section__heading">
          <h2>内容可以变化，识别保持清晰</h2>
          <p>文本、网址与图片共用同一套动态发布流程。</p>
        </div>

        <div className="style-content-tabs" role="tablist" aria-label="二维码内容类型">
          {contentTypes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeContent === id ? "is-active" : ""}
              aria-selected={activeContent === id}
              role="tab"
              onClick={() => setActiveContent(id)}
            >
              <Icon size={18} />{label}
            </button>
          ))}
        </div>

        <div className="style-specimens" aria-label="二维码视觉模板">
          {marketingQrStyles.map((style, index) => (
            <button
              key={style.name}
              type="button"
              className={`style-specimen ${style.inverted ? "style-specimen--dark" : ""} ${selectedStyle === index ? "is-selected" : ""}`}
              onClick={() => setSelectedStyle(index)}
              aria-pressed={selectedStyle === index}
            >
              <span className="style-specimen__pin">{String(index + 1).padStart(2, "0")}</span>
              <strong>{style.name}</strong>
              <QrSpecimen
                background={style.inverted ? "#080b0d" : "#f2efe8"}
                color={style.color}
                data={`https://tpqr.example/s/style-${activeContent}-${index}`}
                dotType={style.dotType}
                finderType={style.finderType}
                logo={index === 2 || index === 4}
                size={170}
              />
              {selectedStyle === index ? <span className="style-specimen__selected"><Check size={13} />已选择</span> : null}
            </button>
          ))}
        </div>

        <div className="style-controls">
          <div><span>前景色</span><strong><i className="swatch swatch--ink" />#080B0D</strong></div>
          <div><span>背景色</span><strong><i className="swatch swatch--paper" />#F2EFE8</strong></div>
          <div><span>中心 Logo</span><strong><i className="mini-logo">TP</i>开启</strong></div>
          <p><Check size={20} />所有样式都必须通过真实扫码验证</p>
          <a className="style-controls__action" href="#templates">打开样式编辑器 <ArrowRight /></a>
        </div>
      </div>
    </section>
  );
}
