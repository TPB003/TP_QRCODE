export interface Bindings {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: "development" | "staging" | "production" | "test";
  APP_ORIGIN: string;
  AUTH_DELIVERY_MODE?: "dev" | "resend";
  AUTH_TEST_CODE?: string;
  AUTH_ALLOWED_EMAILS?: string;
  TURNSTILE_SITE_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  TURNSTILE_SECRET_KEY?: string;
  SESSION_COOKIE_SECRET?: string;
}
