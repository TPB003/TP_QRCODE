import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { builderFieldLabel, type BuilderField } from "../model/form-fields";

interface SortableFieldRowProps {
  field: BuilderField;
  onDuplicate: (field: BuilderField) => void;
  onLabelChange: (id: string, label: string) => void;
  onRemove: (id: string) => void;
  onRequiredChange: (id: string, required: boolean) => void;
}

export function SortableFieldRow({ field, onDuplicate, onLabelChange, onRemove, onRequiredChange }: SortableFieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  return (
    <article ref={setNodeRef} className={`builder-field-row ${isDragging ? "is-dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button className="builder-field-row__drag" type="button" aria-label={`拖动 ${field.label}`} {...attributes} {...listeners}><GripVertical /></button>
      <input className="builder-field-row__label" aria-label={`字段名称 ${field.label}`} value={field.label} maxLength={50} onChange={(event) => onLabelChange(field.id, event.target.value)} />
      <span>{builderFieldLabel(field.type)}{field.options?.length ? ` · ${field.options.join(" / ")}` : ""}</span>{field.required ? <b>*</b> : null}
      <label className="required-toggle"><span>必填</span><input type="checkbox" checked={field.required} onChange={(event) => onRequiredChange(field.id, event.target.checked)} /></label>
      <button type="button" aria-label={`复制 ${field.label}`} onClick={() => onDuplicate(field)}><Copy /></button>
      <button type="button" aria-label={`删除 ${field.label}`} onClick={() => onRemove(field.id)}><Trash2 /></button>
    </article>
  );
}
