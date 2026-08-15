import { TEMPLATE_LABELS, type TEMPLATE_KEYS } from "@shared/constants/product";
import type { FormSchema } from "@shared/types/domain";

type TemplateKey = (typeof TEMPLATE_KEYS)[number];

function field(type: FormSchema["fields"][number]["type"], label: string, required = false, options?: string[]) {
  return { id: crypto.randomUUID(), type, label, required, ...(options ? { options } : {}) };
}

export function templateSchema(templateKey: TemplateKey): FormSchema {
  const common = {
    coverAssetId: null,
    description: "请按照实际情况填写内容，提交后由创建者统一查看。",
  };

  if (templateKey === "checkin") {
    return { ...common, title: TEMPLATE_LABELS[templateKey], fields: [field("shortText", "姓名", true), field("phone", "联系电话", true), field("dateTime", "签到时间", true)] };
  }
  if (templateKey === "personnel") {
    return { ...common, title: TEMPLATE_LABELS[templateKey], fields: [field("shortText", "姓名", true), field("phone", "联系电话", true), field("email", "邮箱"), field("shortText", "部门", true)] };
  }
  if (templateKey === "collection") {
    return { ...common, title: TEMPLATE_LABELS[templateKey], fields: [field("shortText", "联系人", true), field("email", "邮箱"), field("longText", "详细内容", true), field("image", "相关图片")] };
  }
  return {
    ...common,
    title: TEMPLATE_LABELS.inspection,
    description: "请按照实际情况填写巡检内容，确保设备运行正常。",
    fields: [
      field("shortText", "设备名称", true),
      field("shortText", "巡检人", true),
      field("date", "巡检日期", true),
      field("singleChoice", "巡检结果", true, ["运行正常", "发现异常"]),
      field("longText", "异常说明"),
      field("image", "现场照片"),
    ],
  };
}

export function templateList() {
  return Object.entries(TEMPLATE_LABELS).map(([key, label]) => ({ key, label }));
}
