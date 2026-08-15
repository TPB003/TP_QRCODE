import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".wrangler",
  "node_modules",
  "dist",
  "coverage",
  "tmp",
  "output",
  "archive",
  "playwright-report",
  "test-results",
]);
const textExtensions = /\.(?:json|jsonc|md|ts|tsx|js|mjs|css|sql|ya?ml|toml|txt|html)$/i;
const failures = [];

const relative = (file) => path.relative(root, file).replaceAll(path.sep, "/");
const isExampleEnvironment = (name) =>
  name === ".env.example" || name === ".dev.vars.example" || name.endsWith(".example");

function checkPath(file) {
  const name = path.basename(file);
  if ((name === ".dev.vars" || name === ".env" || name.startsWith(".env.")) && !isExampleEnvironment(name)) {
    failures.push(`private environment file: ${relative(file)}`);
  }
}

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const full = path.join(directory, entry);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) {
      failures.push(`symbolic link is not reproducible: ${relative(full)}`);
      continue;
    }
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }

    checkPath(full);
    if (!textExtensions.test(entry)) continue;
    const file = relative(full);
    const content = readFileSync(full, "utf8");

    // UUIDs used by deterministic fixtures are intentionally all 1/2/3/...;
    // any other D1-looking UUID must be replaced with a deployment placeholder.
    const uuidValues = content.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi) ?? [];
    for (const value of uuidValues) {
      if (!/^([0-9a-f])\1{7}-\1{4}-4\1{3}-[89a-f]\1{3}-\1{11}[0-9a-f]$/i.test(value)) {
        failures.push(`possible Cloudflare/resource UUID in ${file}: ${value}`);
      }
    }

    const suspiciousSecret = /(?:api[_-]?key|secret|access[_-]?token|private[_-]?key)\s*[:=]\s*["'][^"']{16,}["']/i;
    if (suspiciousSecret.test(content) && !/replace-with|your[-_]|example|placeholder/i.test(content)) {
      failures.push(`possible secret in ${file}`);
    }

    // Permit documentation placeholders but reject a concrete Worker host.
    const workerHosts = content.match(/https?:\/\/([a-z0-9-]+)\.workers\.dev\b/gi) ?? [];
    for (const host of workerHosts) {
      if (!/replace-with|example|your[-_]/i.test(host)) failures.push(`concrete workers.dev host in ${file}: ${host}`);
    }

    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
      failures.push(`private key material in ${file}`);
    }
  }
}

walk(root);
for (const required of ["README.md", "LICENSE", "CONTRIBUTING.md", "SECURITY.md"]) {
  if (!existsSync(path.join(root, required))) failures.push(`${required} is required`);
}

if (failures.length) {
  console.error("Open-source boundary check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Open-source boundary check passed.");
}
