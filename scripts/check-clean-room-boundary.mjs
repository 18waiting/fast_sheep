// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M0 gate: clean-room boundary — rebuild source/config must not reference forbidden
// reverse-engineering artifacts (original binaries, recovered bytecode, .jsc/.pyc paths).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const SKIP = new Set(["node_modules","dist","coverage",".git","project","reports","docs"]); // governance/evidence docs exempt (they must name reference trees)
const FORBIDDEN = [
  "FastWork.exe", "app.asar", "FastWork_asar_extracted", "fastwork_asar",
  "static/python/ai_bridge/recovered", "recovered/", ".pyc", "ai_bridge.dist", "auth_bridge.dist",
  "ilink_bridge", ".jsc", "resources/python",
];
const EXT = new Set([".ts",".mjs",".js",".json",".toml",".yml",".yaml",".py",".md",".gitignore",".editorconfig"]);
function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (!SKIP.has(e)) walk(p, out); }
    else if (EXT.has(extname(p)) && p !== import.meta.filename && basename(p) !== "AGENTS.md") out.push(p);
  }
}
const files = [];
walk(REBUILD, files);
let findings = 0;
for (const f of files) {
  const rel = f.replace(REBUILD + "\\", "").replace(/\\/g, "/");
  const text = readFileSync(f, "utf-8");
  for (const tok of FORBIDDEN) {
    if (text.includes(tok)) {
      console.warn(`BOUNDARY ${tok} referenced in ${rel}`);
      findings++;
    }
  }
}
if (findings === 0) console.log("PASS: clean-room boundary clean");
else { console.error(`FAIL: ${findings} forbidden reference(s)`); process.exit(1); }
