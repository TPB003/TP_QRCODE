import { useEffect, useState, type CSSProperties } from "react";
import { Camera, Check, Maximize, ShieldCheck, X } from "lucide-react";
import { useParams } from "react-router-dom";
import { LogoMark } from "@client/components/ui/logo-mark";
import { generatedAssets } from "@client/lib/assets";
import { api, type PublicResponse } from "@client/lib/api";
import type { FormField } from "@shared/types/domain";
import "../public-scan.css";

type FieldValue = string | string[];

export function PublicScanView() {
  const { slug = "TPQRDEMO01" } = useParams();
  const [publicData, setPublicData] = useState<PublicResponse | null>(null);
  const [result, setResult] = useState<"normal" | "abnormal">("normal");
  const [description, setDescription] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>({});
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void api.publicPage(slug).then((data) => {
      setPublicData(data);
      if (data.project.content.type === "form" || data.project.content.type === "business") {
        setFieldValues(Object.fromEntries(data.project.content.schema.fields.map((field) => [field.id, field.label === "设备名称" ? data.entity.name : ""])));
      }
    }).catch((error) => setNotice(error instanceof Error ? error.message : "二维码页面加载失败"));
  }, [slug]);

  useEffect(() => () => previews.filter((preview) => preview.startsWith("blob:")).forEach((preview) => URL.revokeObjectURL(preview)), [previews]);

  function addImages(files: FileList | null) {
    if (!files) return;
    const selectedFiles = Array.from(files).slice(0, 5 - previews.length);
    const next = selectedFiles.map((file) => URL.createObjectURL(file));
    setFiles((current) => [...current, ...selectedFiles]);
    setPreviews((current) => [...current, ...next]);
  }

  function setFieldValue(fieldId: string, value: FieldValue) {
    setFieldValues((current) => ({ ...current, [fieldId]: value }));
    setNotice("");
  }

  function renderField(field: FormField) {
    const value = fieldValues[field.id] ?? "";
    if (field.type === "longText") return <label className="public-form-field" key={field.id}><span>{field.label}{field.required ? <b>*</b> : null}</span><textarea value={typeof value === "string" ? value : value.join(", ")} onChange={(event) => setFieldValue(field.id, event.target.value)} /></label>;
    if (field.type === "singleChoice") return <fieldset className="public-form-choice" key={field.id}><legend>{field.label}{field.required ? <b>*</b> : null}</legend><div>{(field.options ?? []).map((option) => <label key={option}><input type="radio" name={field.id} value={option} checked={value === option} onChange={() => setFieldValue(field.id, option)} /><span>{option}</span></label>)}</div></fieldset>;
    if (field.type === "multipleChoice") {
      const selected = Array.isArray(value) ? value : [];
      return <fieldset className="public-form-choice" key={field.id}><legend>{field.label}{field.required ? <b>*</b> : null}</legend><div>{(field.options ?? []).map((option) => <label key={option}><input type="checkbox" value={option} checked={selected.includes(option)} onChange={(event) => setFieldValue(field.id, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} /><span>{option}</span></label>)}</div></fieldset>;
    }
    if (field.type === "image") return <label className="public-form-field" key={field.id}><span>{field.label}{field.required ? <b>*</b> : null}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addImages(event.target.files); setFieldValue(field.id, event.target.files?.length ? "uploaded" : ""); }} /></label>;
    const inputType = field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "dateTime" ? "datetime-local" : "text";
    return <label className="public-form-field" key={field.id}><span>{field.label}{field.required ? <b>*</b> : null}</span><input type={inputType} value={typeof value === "string" ? value : value.join(", ")} onChange={(event) => setFieldValue(field.id, event.target.value)} /></label>;
  }

  async function submit() {
    try {
      const values: Record<string, unknown> = { ...fieldValues, result: result === "normal" ? "运行正常" : "发现异常", description };
      const formFields = publicData?.project.content.type === "form" || publicData?.project.content.type === "business" ? publicData.project.content.schema.fields : [];
      for (const field of formFields) {
        if (field.label === "巡检结果") values[field.id] = values.result;
        else if (field.label === "异常说明") values[field.id] = description;
        else if (field.label === "现场照片" && files.length > 0) values[field.id] = "uploaded";
      }
      const missing = formFields.filter((field) => {
        const value = values[field.id];
        return field.required && (value === undefined || value === "" || (Array.isArray(value) && value.length === 0));
      });
      if (missing.length > 0) {
        setNotice(`请填写必填字段：${missing.map((field) => field.label).join("、")}`);
        return;
      }
      await api.submitPublic(slug, values, files);
      setSubmitted(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "提交失败");
    }
  }

  const formFields = publicData?.project.content.type === "form" || publicData?.project.content.type === "business" ? publicData.project.content.schema.fields : [];
  const isInspection = publicData?.project.content.type === "business" && publicData.project.content.templateKey === "inspection";
  const visibleFields = formFields.filter((field) => !isInspection || !["巡检结果", "异常说明", "现场照片"].includes(field.label));

  if (!publicData && notice) return <main className="public-scan-page"><section className="public-scan-card public-scan-error"><LogoMark /><h1>二维码页面不可用</h1><p role="alert">{notice}</p><a href="/">返回首页</a></section></main>;

  return (
    <main className="public-scan-page" style={{ "--paper-texture": `url(${generatedAssets.archivalPaperTexture})` } as CSSProperties}>
      <section className="public-scan-card">
        <header><LogoMark /><Maximize /></header>
        <h1>{publicData?.project.name ?? "设备巡检记录"}</h1>
        {isInspection ? <article className="equipment-card"><img src={generatedAssets.equipmentCompressor} alt={publicData?.entity.name ?? "设备"} /><div><strong>{publicData?.entity.name ?? "设备"}</strong><span>设备编号 {publicData?.entity.externalId ?? ""}</span><span>{publicData?.entity.fields["位置"] ?? ""}</span></div><footer><span>设备状态</span><b>设备状态正常</b></footer></article> : null}
        {visibleFields.map(renderField)}
        {isInspection ? <><fieldset><legend>巡检结果</legend><div><label className={result === "normal" ? "is-selected" : ""}><input type="radio" name="result" value="normal" checked={result === "normal"} onChange={() => setResult("normal")} /><i /><span>运行正常</span></label><label className={result === "abnormal" ? "is-selected" : ""}><input type="radio" name="result" value="abnormal" checked={result === "abnormal"} onChange={() => setResult("abnormal")} /><i /><span>发现异常</span></label></div></fieldset><label className="scan-description"><strong>异常说明</strong><textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 200))} placeholder="请描述异常现象（选填）" /><span>{description.length}/200</span></label><div className="scan-photos"><strong>现场图片</strong><div>{previews.map((preview) => <figure key={preview}><img src={preview} alt="巡检现场预览" /><button type="button" aria-label="删除图片" onClick={() => { setPreviews((current) => current.filter((item) => item !== preview)); setFiles((current) => current.slice(0, -1)); }}><X /></button></figure>)}{previews.length < 5 ? <label><Camera /><span>上传图片</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => addImages(event.target.files)} /></label> : null}</div><small>支持 JPG / PNG / WebP，最多上传 5 张</small></div></> : null}
        <p className="scan-trust"><ShieldCheck />无需登录，数据将安全提交给二维码的创建者</p>
        <button className="scan-submit" type="button" onClick={() => void submit()}>提交巡检记录</button>
      </section>
      {notice ? <p className="scan-notice" role="status">{notice}</p> : null}
      {submitted ? <div className="scan-success" role="dialog" aria-modal="true" aria-label="提交成功"><div><Check /><h2>提交成功</h2><p>感谢您的提交！</p><button type="button" onClick={() => setSubmitted(false)}>完成</button></div></div> : null}
    </main>
  );
}
