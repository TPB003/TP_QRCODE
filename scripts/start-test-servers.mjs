import { spawn } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const children = [];
let shuttingDown = false;

function start(args) {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", `npm ${args.join(" ")}`] : args;
  const child = spawn(command, commandArgs, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const exitCode = typeof code === "number" ? code : signal ? 1 : 0;
    void shutdown(exitCode);
  });
  child.on("error", (error) => {
    if (shuttingDown) return;
    console.error(error);
    shuttingDown = true;
    void shutdown(1);
  });
}

async function shutdown(exitCode = 0) {
  if (!shuttingDown) shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (const child of children) {
    if (!child.killed) child.kill("SIGKILL");
  }
  process.exit(exitCode);
}

process.once("SIGINT", () => void shutdown(130));
process.once("SIGTERM", () => void shutdown(143));

// Keep the two runtimes independent. On Windows this avoids the nested
// concurrently wrapper occasionally terminating workerd while Playwright is
// still using the API proxy.
start(["run", "dev:client", "--", "--port", "5173"]);
// Use Wrangler's compatibility-date runtime for repeatable local tests. The
// latest runtime's proxy worker can occasionally disconnect after a long
// browser run on Windows, which makes the test report look like application
// 502s even though the Worker handlers are healthy.
start(["run", "dev:worker", "--", "--latest=false", "--show-interactive-dev-session=false"]);
