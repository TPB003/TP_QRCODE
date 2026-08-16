#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promises as dns } from "node:dns";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const args = process.argv.slice(2);

function log(message) { process.stdout.write(`${message}\n`); }
function fail(message) { process.stderr.write(`tpqr: ${message}\n`); process.exitCode = 1; }

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? 1}`);
}

function commandAvailable(command) {
  const result = spawnSync(process.platform === "win32" ? "where" : "which", [command], { cwd: root, stdio: "ignore", shell: process.platform === "win32" });
  return result.status === 0;
}

function readFlag(name, fallback = undefined) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

function hasFlag(name) { return args.includes(name); }

function configText(configPath) {
  if (!configPath || !existsSync(resolve(root, configPath))) return "";
  return readFileSync(resolve(root, configPath), "utf8");
}

async function doctor() {
  log(`root: ${root}`);
  log(`node: ${process.version}`);
  log(`npm: ${commandAvailable("npm") ? "available" : "missing"}`);
  log(`git: ${commandAvailable("git") ? "available" : "missing"}`);
  log(`wrangler: ${commandAvailable("wrangler") || commandAvailable("npx") ? "available through npx" : "missing"}`);
  log(`gh: ${commandAvailable("gh") ? "available (authentication is not inspected here)" : "optional / missing"}`);
  log(`private tmp: ${existsSync(resolve(root, "tmp")) ? "available" : "missing"}`);
}

async function inspectDomain(domain) {
  if (!domain || !/^[a-z0-9.-]+$/iu.test(domain)) throw new Error("provide a valid domain, for example: tpqrcode.shop");
  try {
    const nameservers = await dns.resolveNs(domain);
    log(`nameservers: ${nameservers.join(", ")}`);
  } catch (error) {
    log(`nameservers: unavailable (${error instanceof Error ? error.code ?? error.message : "lookup failed"})`);
  }
  const url = `https://${domain}/api/health`;
  try {
    const response = await fetch(url, { redirect: "manual" });
    log(`health: ${response.status} ${response.statusText}`);
    log(`url: ${url}`);
  } catch (error) {
    log(`health: unavailable (${error instanceof Error ? error.message : "request failed"})`);
    process.exitCode = 1;
  }
}

function oauthCheck() {
  const names = ["AUTH_GOOGLE_CLIENT_ID", "AUTH_GOOGLE_CLIENT_SECRET", "AUTH_GITHUB_CLIENT_ID", "AUTH_GITHUB_CLIENT_SECRET", "AUTH_OAUTH_CALLBACK_ORIGIN"];
  for (const name of names) log(`${name}: ${process.env[name] ? "set" : "missing"}`);
  if (!process.env.AUTH_GOOGLE_CLIENT_ID || !process.env.AUTH_GOOGLE_CLIENT_SECRET) log("google: disabled until both client values are configured");
  if (!process.env.AUTH_GITHUB_CLIENT_ID || !process.env.AUTH_GITHUB_CLIENT_SECRET) log("github: disabled until both client values are configured");
  if (!process.env.AUTH_OAUTH_CALLBACK_ORIGIN) process.exitCode = 1;
}

function productionGuard(configPath, environment) {
  const text = configText(configPath);
  if (!text) throw new Error(`config not found: ${configPath}`);
  if (text.includes("replace-with-")) throw new Error("config still contains replace-with-* placeholders");
  if (environment === "production") {
    if (!hasFlag("--confirm-production")) throw new Error("production deploy requires --confirm-production");
    if (!text.includes('"APP_ORIGIN": "https://') && !text.includes('"APP_ORIGIN":"https://')) throw new Error("production APP_ORIGIN must use HTTPS");
    if (text.includes('"AUTH_DELIVERY_MODE": "dev"') || text.includes('"AUTH_TEST_CODE"')) throw new Error("production config cannot use dev auth or AUTH_TEST_CODE");
    if (!text.includes('"custom_domain": true')) throw new Error("production config must declare a custom domain");
  }
}

async function deploy() {
  const environment = readFlag("--environment", "staging");
  const configPath = readFlag("--config");
  if (!configPath) throw new Error("deploy requires --config <private-config>");
  productionGuard(configPath, environment);
  if (hasFlag("--dry-run")) {
    log(`dry-run: ${environment} config ${configPath} passed preflight`);
    return;
  }
  run("npm", ["run", "build"]);
  run("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--remote", "--config", configPath]);
  run("npx", ["wrangler", "deploy", "--config", configPath]);
}

async function main() {
  const [group, action] = args;
  if (group === "doctor") return doctor();
  if (group === "domain" && action === "inspect") return inspectDomain(args[2]);
  if (group === "oauth" && action === "check") return oauthCheck();
  if (group === "local" && action === "setup") return run("npm", ["run", "setup:local"]);
  if (group === "check") return run("npm", ["run", "check:all"]);
  if (group === "release" && action === "verify") {
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
    if (status) throw new Error("working tree is not clean");
    return run("npm", ["run", "check:all"]);
  }
  if (group === "deploy") return deploy();
  log("usage: tpqr doctor | local setup | check | domain inspect <domain> | oauth check | deploy --environment <env> --config <path> [--dry-run] | release verify");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
