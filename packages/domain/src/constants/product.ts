export const PROJECT_STATUSES = ["active", "paused", "archived", "deleted"] as const;

/** Public QR content kinds. The legacy project kinds remain below for migration. */
export const ACTIVE_CONTENT_TYPES = ["image", "video", "audio", "file", "url", "contact", "text"] as const;
export type ActiveContentType = (typeof ACTIVE_CONTENT_TYPES)[number];

/** @deprecated use ACTIVE_CONTENT_TYPES for newly created QR codes. */
export const PROJECT_KINDS = ["text", "url", "image", "form", "business"] as const;

export const TEMPLATE_KEYS = ["checkin", "personnel", "inspection", "collection"] as const;

export const TEMPLATE_LABELS: Record<(typeof TEMPLATE_KEYS)[number], string> = {
  checkin: "签到报名",
  personnel: "人员管理",
  inspection: "设备巡检",
  collection: "信息收集",
};

export const FORM_FIELD_TYPES = [
  "shortText",
  "longText",
  "number",
  "phone",
  "email",
  "singleChoice",
  "multipleChoice",
  "date",
  "dateTime",
  "image",
] as const;

export const QR_DOT_STYLES = ["square", "rounded", "dots", "classy", "classy-rounded", "extra-rounded"] as const;

export const QR_CORNER_STYLES = ["square", "dot", "extra-rounded"] as const;

export const PRODUCT_LIMITS = {
  logoBytes: 2 * 1024 * 1024,
  imageBytes: 10 * 1024 * 1024,
  formFields: 50,
  batchEntities: 200,
  slugLength: 10,
  deleteRetentionDays: 30,
} as const;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const ALLOWED_MEDIA_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
  "text/plain",
] as const;

export const PRODUCT_CONTENT_LIMITS = {
  textCharacters: 4_000,
  titleCharacters: 120,
  urlCharacters: 2_048,
  contactCharacters: 4_000,
  mediaBytes: 50 * 1024 * 1024,
  fileBytes: 100 * 1024 * 1024,
  attachmentCount: 10,
} as const;

export const ERROR_CODES = {
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  notFound: "NOT_FOUND",
  validation: "VALIDATION_ERROR",
  revisionConflict: "REVISION_CONFLICT",
  rateLimited: "RATE_LIMITED",
  uploadRejected: "UPLOAD_REJECTED",
  internal: "INTERNAL_ERROR",
} as const;
