import { useEffect, useState } from "react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CalendarDays, FileImage, Hash, Mail, Paperclip, Phone, Plus, Save, Send, Type } from "lucide-react";
import { useParams } from "react-router-dom";
import { ProjectShell } from "@client/components/layout/project-shell";
import { generatedAssets } from "@client/lib/assets";
import { api } from "@client/lib/api";
import type { FormField, ProjectDraft } from "@shared/types/domain";
import { builderFieldLabel, fieldLibrary, initialBuilderFields, type BuilderField, type BuilderFieldType } from "../model/form-fields";
import { SortableFieldRow } from "./sortable-field-row";
import "../form-builder.css";

function fieldIcon(type: BuilderFieldType) {
  if (type === "电话") return Phone;
  if (type === "邮箱") return Mail;
  if (type === "数字") return Hash;
  if (type === "日期" || type === "日期时间") return CalendarDays;
  if (type === "图片上传") return FileImage;
  return Type;
}

const toUiType: Record<FormField["type"], BuilderFieldType> = { shortText: "短文本", longText: "长文本", number: "数字", phone: "电话", email: "邮箱", singleChoice: "单选", multipleChoice: "多选", date: "日期", dateTime: "日期时间", image: "图片上传" };
const toSchemaType: Record<BuilderFieldType, FormField["type"]> = Object.fromEntries(Object.entries(toUiType).map(([key, value]) => [value, key])) as Record<BuilderFieldType, FormField["type"]>;

export function FormBuilderView() {
  const { projectId = "" } = useParams();
  const [fields, setFields] = useState(initialBuilderFields);
  const [activeTab, setActiveTab] = useState("表单");
  const [status, setStatus] = useState("尚有未发布修改");
  const [revision, setRevision] = useState(0);
  const [project, setProject] = useState<ProjectDraft | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    void api.project(projectId).then(({ project: loaded }) => {
      setProject(loaded);
      setRevision(loaded.revision);
      const schema = loaded.content.type === "form" || loaded.content.type === "business" ? loaded.content.schema : null;
      if (schema) setFields(schema.fields.map((field) => ({ id: field.id, label: field.label, required: field.required, type: toUiType[field.type], options: field.options })));
    }).catch(() => setStatus("项目加载失败"));
  }, [projectId]);

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    setFields((currentFields) => {
      const oldIndex = currentFields.findIndex((field) => field.id === event.active.id);
      const newIndex = currentFields.findIndex((field) => field.id === event.over?.id);
      return arrayMove(currentFields, oldIndex, newIndex);
    });
    setStatus("尚有未发布修改");
  }

  function addField(type: BuilderFieldType) {
    const options = type === "单选" || type === "多选" ? ["选项一", "选项二"] : undefined;
    const label = type === "图片上传" ? "现场照片" : `新${type}`;
    setFields((currentFields) => [...currentFields, { id: crypto.randomUUID(), label, type, required: false, options }]);
    setStatus("尚有未发布修改");
  }

  function duplicateField(field: BuilderField) {
    setFields((currentFields) => [...currentFields, { ...field, id: crypto.randomUUID(), label: `${field.label}副本` }]);
  }

  function schemaFields(): FormField[] {
    return fields.map((field) => ({
      id: field.id.match(/^[0-9a-f-]{36}$/i) ? field.id : crypto.randomUUID(),
      type: toSchemaType[field.type],
      label: field.label.trim(),
      required: field.required,
      ...(field.options?.length ? { options: field.options.map((option) => option.trim()).filter(Boolean) } : {}),
    }));
  }

  async function saveDraft(): Promise<ProjectDraft | null> {
    if (!project) return null;
    const currentContent = project.content.type === "business" ? { ...project.content, schema: { ...project.content.schema, fields: schemaFields() } } : { type: "form" as const, schema: { title: project.content.type === "form" ? project.content.schema.title : "设备巡检记录", description: project.content.type === "form" ? project.content.schema.description : "请按照实际情况填写巡检内容，确保设备运行正常。", coverAssetId: project.content.type === "form" ? project.content.schema.coverAssetId : null, fields: schemaFields() } };
    try {
      const updated = await api.updateProject(projectId, revision, { content: currentContent });
      setProject(updated);
      setRevision(updated.revision);
      setStatus("草稿已保存");
      return updated;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
      return null;
    }
  }

  async function publish() {
    try {
      const saved = await saveDraft();
      if (!saved) return;
      const result = await api.publishProject(projectId, saved.revision);
      setRevision(result.project.revision);
      setStatus("发布成功");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "发布失败");
    }
  }

  return (
    <ProjectShell>
      <section className="form-builder-view">
        <header className="form-builder-toolbar"><strong>TP QR PAPER WORKBENCH</strong><span>8 / 11</span><div><button type="button" onClick={() => void saveDraft()}><Save />保存草稿</button><button type="button">预览</button><button type="button" onClick={() => void publish()}><Send />发布更新</button></div></header>
        <div className="form-builder-heading"><h1>FORM /<br />FIXTURE</h1><div className="form-tabs">{["展示页", "表单", "设置"].map((tab) => <button className={activeTab === tab ? "is-active" : ""} key={tab} type="button" onClick={() => setActiveTab(tab)}>{tab}</button>)}</div><h2>设备巡检记录</h2><p>请按照实际情况填写巡检内容，确保设备运行正常。</p><img src={generatedAssets.industrialCover} alt="工业设备巡检封面" /></div>

        <aside className="field-library paper-builder-sheet"><h3>字段库</h3>{fieldLibrary.map((type) => { const Icon = fieldIcon(type); const isAttachment = type === "图片上传"; return <button className={isAttachment ? "field-library__attachment" : undefined} key={type} type="button" aria-label={`添加${builderFieldLabel(type)}字段`} onClick={() => addField(type)}><Icon /><span>{builderFieldLabel(type)}</span></button>; })}<p className="field-library__hint"><Paperclip />附件字段会在公共表单显示图片选择器，最多上传 5 个附件。</p><button className="field-library__add" type="button" onClick={() => addField("短文本")}><Plus />添加字段</button></aside>

        <div className="builder-fields paper-builder-sheet">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
              {fields.map((field) => <SortableFieldRow key={field.id} field={field} onDuplicate={duplicateField} onLabelChange={(id, label) => { setFields((currentFields) => currentFields.map((item) => item.id === id ? { ...item, label } : item)); setStatus("尚有未发布修改"); }} onRemove={(id) => { setFields((currentFields) => currentFields.filter((item) => item.id !== id)); setStatus("尚有未发布修改"); }} onRequiredChange={(id, required) => { setFields((currentFields) => currentFields.map((item) => item.id === id ? { ...item, required } : item)); setStatus("尚有未发布修改"); }} />)}
            </SortableContext>
          </DndContext>
        </div>

        <aside className="form-preview paper-builder-sheet"><header><h3>公共页面预览</h3><span>{status}</span></header><div className="form-preview__phone"><strong>设备巡检记录</strong><img src={generatedAssets.industrialCover} alt="工业设备巡检现场" /><p>请按照实际情况填写巡检内容，确保设备运行正常。</p>{fields.map((field) => <label key={field.id}><span>{field.type === "图片上传" ? `${builderFieldLabel(field.type)} · ${field.label}` : field.label}{field.required ? <b>*</b> : null}</span>{field.type === "图片上传" ? <><input type="file" accept="image/jpeg,image/png,image/webp" multiple /><small>支持 JPG / PNG / WebP，最多上传 5 个附件</small></> : <input placeholder={field.type === "日期" ? "选择日期" : `请输入${field.label}`} />}</label>)}</div></aside>
      </section>
    </ProjectShell>
  );
}
