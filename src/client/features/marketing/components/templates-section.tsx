import { ArrowRight, ClipboardCheck, Contact, DoorOpen, FileInput, MapPin, Phone, Users, Wrench } from "lucide-react";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { businessTemplates } from "../model/marketing-data";

const templateIcons = [ClipboardCheck, Contact, Wrench, FileInput, DoorOpen];
const entities = [
  { name: "空压机 1 号", id: "EQP-AC-0001", type: "设备" },
  { name: "配电柜 3 号", id: "PDB-3-0003", type: "配电" },
  { name: "消防栓 A-12", id: "HOS-A-0012", type: "消防" },
];

export function TemplatesSection() {
  return (
    <section className="templates-section" id="templates">
      <div className="templates-section__heading">
        <span className="templates-section__number">04</span>
        <p>BATCH<br />DOSSIER</p>
        <h2>一套模板，生成每一个独立二维码</h2>
      </div>

      <div className="template-tags" aria-label="业务模板">
        {businessTemplates.map((template, index) => {
          const Icon = templateIcons[index];
          return <article key={template}><span aria-hidden="true" /><Icon /><strong>{template}</strong></article>;
        })}
      </div>

      <div className="batch-flow">
        <article className="csv-sheet paper-texture">
          <header><strong>CSV 导入</strong><span>单次最多 200 条</span></header>
          <code>id,name,type,location,dept,owner,phone</code>
          <ol>
            <li>空压机 1 号，设备，一车间，设备部，张工</li>
            <li>配电柜 3 号，设备，二车间，电气部，李工</li>
            <li>消防栓 A-12，设备，东区通道，安防部，王工</li>
            <li>设备 X，设备，仓库，设备部，—</li>
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
              <QrSpecimen data={`https://tpqr.example/s/entity-${index}`} size={128} />
              <div><strong>{entity.name}</strong><code>{entity.id}</code><span>{entity.type}</span></div>
            </article>
          ))}
        </div>
      </div>

      <a className="templates-section__action" href="#data">批量生成 <ArrowRight /></a>
    </section>
  );
}
