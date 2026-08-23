// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M0 gate: secret-pattern guardrail over clean-room implementation artifacts.
// Prints only file/line/category/redacted fingerprint — never the full suspected value.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const SCAN_EXT = new Set([".ts",".mjs",".js",".json",".toml",".yml",".yaml",".py",".md"]);
const SKIP_DIRS = new Set(["node_modules","dist","coverage",".git"]);
// Allowlisted safe values (REDACTED placeholders / explicit fake/test/example prefixes).
const ALLOW = /<REDACTED_SECRET>|^(fake_|test_|example_)|sk-fake|SUPER-SECRET-VALUE|super-secret-value/;
const PATTERNS = [
  { name: "api_key", re: /(api[_-]?key|apikey)\s*[:=]\s*["']?([A-Za-z0-9_\-]{12,})/i },
  { name: "bearer", re: /(Bearer|bearer)\s+([A-Za-z0-9._\-]{20,})/ },
  { name: "authorization", re: /(authorization)\s*[:=]\s*["']?([A-Za-z0-9._\-]{16,})/i },
  { name: "private_key", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];
function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(e)) walk(p, out); }
    else if (SCAN_EXT.has(extname(p))) out.push(p);
  }
}
const files = [];
walk(REBUILD, files);
let findings = 0;
for (const f of files) {
  const lines = readFileSync(f, "utf-8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const pat of PATTERNS) {
      const m = pat.re.exec(line);
      if (m && !ALLOW.test(line)) {
        const secret = m[1] ?? "";
        const fp = createHash("sha256").update(secret).digest("hex").slice(0, 12);
        console.warn(`SUSPECT ${pat.name} ${f.replace(REBUILD + "\\", "").replace(/\\/g,"/")}:${i + 1} fp=${fp}`);
        findings++;
      }
    }
  });
}
if (findings === 0) console.log("PASS: secret scan clean");
else { console.error(`FAIL: ${findings} suspicious value(s) found`); process.exit(1); }
