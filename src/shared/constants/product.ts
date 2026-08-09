export const PROJECT_STATUSES = ["active", "paused", "archived", "deleted"] as const;

export const PROJECT_KINDS = ["text", "url", "image", "form", "business"] as const;

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
