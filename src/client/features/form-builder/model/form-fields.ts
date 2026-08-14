export type BuilderFieldType = "短文本" | "长文本" | "数字" | "电话" | "邮箱" | "单选" | "多选" | "日期" | "日期时间" | "图片上传";

export interface BuilderField {
  id: string;
  label: string;
  required: boolean;
  type: BuilderFieldType;
  options?: string[];
}

export const fieldLibrary: BuilderFieldType[] = ["短文本", "长文本", "数字", "电话", "邮箱", "单选", "多选", "日期", "日期时间", "图片上传"];

export function builderFieldLabel(type: BuilderFieldType): string {
  return type === "图片上传" ? "附件 / 图片" : type;
}

export const initialBuilderFields: BuilderField[] = [
  { id: "device-name", label: "设备名称", type: "短文本", required: true },
  { id: "inspector", label: "巡检人", type: "短文本", required: true },
  { id: "inspection-date", label: "巡检日期", type: "日期", required: true },
  { id: "runtime", label: "运行时长", type: "数字", required: true },
  { id: "status", label: "设备状态", type: "单选", required: true, options: ["运行正常", "发现异常"] },
  { id: "description", label: "异常情况描述", type: "长文本", required: false },
  { id: "photos", label: "现场照片", type: "图片上传", required: true },
];
