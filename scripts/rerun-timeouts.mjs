import { execSync } from "node:child_process";
import fs from "node:fs";

const PATH = ".vitest-timeouts.json";
if (!fs.existsSync(PATH)) {
  console.error("No timeouts file found. Run `npm run test:timeout` first.");
  process.exit(1);
}

/** @type {{file:string; name:string}[]} */
const items = JSON.parse(fs.readFileSync(PATH, "utf8"));
if (!items.length) {
  console.log("No timed-out tests recorded.");
  process.exit(0);
}

const byFile = items.reduce((m, t) => {
  (m[t.file] ||= []).push(t.name);
  return m;
}, /** @type {Record<string,string[]>} */({}));

for (const [file, names] of Object.entries(byFile)) {
  const args = names.flatMap((n) => ["-t", JSON.stringify(n)]).join(" ");
  const cmd = `npx vitest run ${file} ${args}`;
  console.log("\nRe-running:", cmd);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

