export interface Bindings {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: "development" | "production" | "test";
  APP_ORIGIN: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  TURNSTILE_SECRET_KEY?: string;
  SESSION_COOKIE_SECRET?: string;
}
