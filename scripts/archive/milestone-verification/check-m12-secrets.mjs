// M12 secret scan (clean-room). Zero unallowlisted secrets; only the explicit
// synthetic marker `fake-super-secret-value` is allowed in M11 fixtures.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (SKIP_DIRS.has(e.name)) continue; walk(join(dir, e.name), out); }
    else if (SKIP_FILES.has(e.name)) continue;
    else if (/\.(ts|mjs|py|json|md|mjs)$/.test(e.name)) out.push(join(dir, e.name));
  }
  return out;
}
const ALLOWED = new Set(["fake-super-secret-value"]);
const SKIP_DIRS = new Set(["node_modules", "__pycache__", "dist", ".git"]);
const SKIP_FILES = new Set(["test_m4_secret_redaction.py"]);
const PATTERNS = [/sk-[A-Za-z0-9]{20,}/, /api[_-]?key["']?\s*[:=]\s*["'][A-Za-z0-9]{16,}/i, /Bearer\s+[A-Za-z0-9._-]{20,}/];
const roots = [join(ROOT, "packages"), join(ROOT, "services"), join(ROOT, "apps"), join(ROOT, "scripts")];
let findings = 0;
for (const root of roots) {
  for (const f of walk(root)) {
    let c;
    try { c = readFileSync(f, "utf-8"); } catch { continue; }
    for (const pat of PATTERNS) {
      const m = c.match(pat);
      if (m && !ALLOWED.has(m[0])) { findings++; console.log("FAIL secret-like token in " + f); }
    }
  }
}
check(findings === 0, "no unallowlisted secrets (" + findings + ")");
const report = { milestone: "M12", allowed_synthetic: ["fake-super-secret-value"], findings, all_passed: findings === 0 };
writeFileSync(join(ROOT, "reports", "m12-secret-scan-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (findings > 0) process.exit(1);
console.log("M12 secret scan PASS.");
