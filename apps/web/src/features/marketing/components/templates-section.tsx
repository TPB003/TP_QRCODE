import { ArrowRight, Contact, FileAudio, FileImage, FileText, FileVideo, Globe2, Link2, ScanLine, Share2 } from "lucide-react";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { businessTemplates } from "../model/marketing-data";

const templateIcons = [FileImage, FileVideo, FileAudio, FileText, Globe2, Contact, FileText];
const contentExamples = [
  { name: "图片与视频", type: "媒体内容", icon: FileImage },
  { name: "网址与名片", type: "分享入口", icon: Link2 },
  { name: "文字与文件", type: "信息资料", icon: FileText },
];

export function TemplatesSection() {
  return (
    <section className="templates-section" id="templates">
      <div className="templates-section__heading">
        <span className="templates-section__number">04</span>
        <p>CONTENT<br />DOSSIER</p>
        <h2>七种内容，一个统一的活码工作台</h2>
      </div>

      <div className="template-tags" aria-label="活码内容类型">
        {businessTemplates.map((template, index) => {
          const Icon = templateIcons[index];
          return <article key={template}><span aria-hidden="true" /><Icon /><strong>{template}</strong></article>;
        })}
      </div>

      <div className="batch-flow">
        <article className="csv-sheet paper-texture">
          <header><strong>创建内容</strong><span>从七类类型开始</span></header>
          <code>选择类型 → 填写内容 → 保存草稿</code>
          <ol>
            <li>上传图片、视频、音频或文件</li>
            <li>输入网址、文字或名片信息</li>
            <li>使用统一的二维码样式预览</li>
            <li>确认后发布不可变版本</li>
          </ol>
        </article>

        <ArrowRight className="batch-flow__arrow" aria-hidden="true" />

        <article className="mapping-board">
          <header>公共页面</header>
          <div className="mapping-board__columns">
            <ul><li><ScanLine />扫码进入</li><li><Share2 />分享链接</li><li><Link2 />保持地址不变</li></ul>
            <ul><li>手机优先布局</li><li>媒体按需加载</li><li>危险链接拦截</li></ul>
          </div>
        </article>

        <ArrowRight className="batch-flow__arrow" aria-hidden="true" />

        <div className="entity-tickets">
          {contentExamples.map(({ name, type, icon: Icon }, index) => (
            <article key={name} className="entity-ticket paper-texture">
              <QrSpecimen data={`TP QR example ${index}`} size={128} />
              <div><strong>{name}</strong><code>示例内容 {index + 1}</code><span>{type}</span><Icon aria-hidden="true" /></div>
            </article>
          ))}
        </div>
      </div>

      <a className="templates-section__action" href="#data">查看访问统计 <ArrowRight /></a>
    </section>
  );
}
