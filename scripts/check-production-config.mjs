#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const configIndex = args.indexOf("--config");
const environmentIndex = args.indexOf("--environment");
const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
const environment = environmentIndex >= 0 ? args[environmentIndex + 1] : "production";

if (!configPath || !existsSync(configPath)) {
  console.error("production config is missing; pass --config <private-config>");
  process.exit(1);
}

const text = readFileSync(configPath, "utf8");
const required = ["APP_ORIGIN", "AUTH_OAUTH_CALLBACK_ORIGIN", "AUTH_DELIVERY_MODE", "custom_domain"];
const missing = required.filter((name) => !text.includes(name));
if (missing.length > 0) {
  console.error(`production config is missing: ${missing.join(", ")}`);
  process.exit(1);
}
if (text.includes("replace-with-")) {
  console.error("production config still contains replace-with-* placeholders");
  process.exit(1);
}
if (environment === "production" && (!text.includes('"APP_ORIGIN": "https://') || text.includes('"AUTH_DELIVERY_MODE": "dev"') || text.includes('"AUTH_TEST_CODE"') || !text.includes('"custom_domain": true'))) {
  console.error("production config must use HTTPS, resend auth, no fixed code, and a custom domain");
  process.exit(1);
}
console.log(`production config preflight passed (${environment})`);
