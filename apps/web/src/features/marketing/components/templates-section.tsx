import { ArrowRight, Contact, FileAudio, FileImage, FileInput, FileText, FileVideo, Globe2, MapPin, Phone, Users, Wrench } from "lucide-react";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { businessTemplates } from "../model/marketing-data";

const templateIcons = [FileImage, FileVideo, FileAudio, FileInput, Globe2, Contact, FileText];
const entities = [
  { name: "品牌手册", id: "IMG-2026-001", type: "图片" },
  { name: "产品介绍", id: "VID-2026-002", type: "视频" },
  { name: "联系卡片", id: "VCF-2026-003", type: "名片" },
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
          <header><strong>批量导入</strong><span>单次最多 200 条</span></header>
          <code>id,title,type,source,description</code>
          <ol>
            <li>IMG-2026-001，品牌手册，图片，CDN，产品视觉资产</li>
            <li>VID-2026-002，产品介绍，视频，CDN，30 秒介绍</li>
            <li>VCF-2026-003，联系卡片，名片，本地，销售团队</li>
            <li>TXT-2026-004，活动说明，文字，编辑器，最新信息</li>
          </ol>
        </article>

        <ArrowRight className="batch-flow__arrow" aria-hidden="true" />

        <article className="mapping-board">
          <header>字段映射</header>
          <div className="mapping-board__columns">
            <ul><li>id [1]</li><li>name [2]</li><li>type [3]</li><li>location [4]</li><li>dept [5]</li><li className="is-error">owner [6]</li><li>phone [7]</li></ul>
            <ul>
              <li><FileInput />名称（必填）</li>
              <li><Wrench />类型（必填）</li>
              <li><MapPin />位置</li>
              <li><Users />部门</li>
              <li className="is-error"><Contact />负责人（必填）</li>
              <li><Phone />电话</li>
            </ul>
          </div>
        </article>

        <ArrowRight className="batch-flow__arrow" aria-hidden="true" />

        <div className="entity-tickets">
          {entities.map((entity, index) => (
            <article key={entity.id} className="entity-ticket paper-texture">
              <QrSpecimen data={`/s/entity-${index}`} size={128} />
              <div><strong>{entity.name}</strong><code>{entity.id}</code><span>{entity.type}</span></div>
            </article>
          ))}
        </div>
      </div>

      <a className="templates-section__action" href="#data">批量生成 <ArrowRight /></a>
    </section>
  );
}
