import process from "node:process";

const major = Number(process.versions.node.split(".")[0]);
const npmVersion = process.env.npm_config_user_agent?.match(/npm\/(\d+)/)?.[1];
const failures = [];
if (major < 22) failures.push(`Node.js 22+ is required; found ${process.versions.node}`);
if (npmVersion && Number(npmVersion) < 10) failures.push(`npm 10+ is required; found npm ${npmVersion}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Environment is compatible (Node ${process.versions.node}${npmVersion ? `, npm ${npmVersion}` : ""}).`);
}
