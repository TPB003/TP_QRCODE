import { ArrowDownRight, Check, Eye, FileEdit, Link2 } from "lucide-react";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { ArchiveCard, CalibrationMark, SectionIndex, StatusDot } from "./visual-primitives";

const steps = [
  { icon: Link2, number: "01", title: "固定短链接", note: "扫码仍访问已发布版本", tone: "blue" as const },
  { icon: FileEdit, number: "02", title: "编辑草稿", note: "草稿有修改", tone: "red" as const },
  { icon: Eye, number: "03", title: "预览验证", note: "公共页尚未切换", tone: "blue" as const },
  { icon: Check, number: "04", title: "发布更新", note: "新版本立即生效", tone: "teal" as const },
];

export function WorkflowSection() {
  return (
    <section className="workflow-section" id="workflow">
      <CalibrationMark className="workflow-section__mark" />
      <div className="workflow-section__heading">
        <h2>同一个码，更新不重印</h2>
        <p>编辑只影响草稿，发布后公共页面才切换到新版本。</p>
        <code>PROJECT : TP QR DYNAMIC PUBLISHING<br />MODULE&nbsp; : PUBLISH FLOW<br />VERSION : V3.2.1</code>
      </div>
      <SectionIndex>STEP 02/11</SectionIndex>

      <div className="workflow-rail" aria-label="动态二维码发布流程">
        {steps.map(({ icon: Icon, number, title, note, tone }, index) => (
          <article className={`workflow-step workflow-step--${tone}`} key={number}>
            <header><span>{number}</span><h3><Icon size={17} />{title}</h3></header>
            <div className="workflow-step__paper paper-texture">
              {index === 0 ? (
                <div className="workflow-step__fixed">
                  <QrSpecimen data="https://tpqr.example/s/AB3xY9" size={150} />
                  <p><strong>短链接（不变）</strong><br /><a href="#product">tpqr.co/AB3xY9</a><br /><StatusDot tone="teal" />已发布</p>
                </div>
              ) : (
                <ArchiveCard title={index === 1 ? "草稿内容（未发布）" : index === 2 ? "预览（仍为已发布版本）" : "已发布（新版本生效）"} accent={tone}>
                  <div className="document-skeleton"><span /><span /><span /><i /></div>
                  <p>{index === 2 ? <Eye size={16} /> : index === 3 ? <Check size={16} /> : <FileEdit size={16} />}{note}</p>
                </ArchiveCard>
              )}
            </div>
            <p className="workflow-step__note">{note}</p>
          </article>
        ))}
      </div>
      <a className="section-link" href="#styles">查看发布流程 <ArrowDownRight /></a>
      <span className="workflow-section__number" aria-hidden="true">02</span>
    </section>
  );
}
