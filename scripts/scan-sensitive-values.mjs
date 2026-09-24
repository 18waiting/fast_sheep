// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M0 gate: secret-pattern guardrail over clean-room implementation artifacts.
// Prints only file/line/category/redacted fingerprint — never the suspected value.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const REVIEW_FILE = join(HERE, "reviewed-secret-scan-findings.json");
const SCAN_EXT = new Set([".ts", ".mjs", ".js", ".json", ".toml", ".yml", ".yaml", ".py", ".md"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git"]);
const ASSIGNMENT = /(?<![A-Za-z0-9_])(?:(["'])(api[_-]?key|apikey|authorization)\1|(api[_-]?key|apikey|authorization))\s*[:=]\s*(?:(["'])([^"'\r\n]*)\4|([A-Za-z0-9_.-]{12,}))/gi;
const BEARER = /\bBearer\s+([A-Za-z0-9._-]{20,})\b/g;
const PRIVATE_KEY = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g;
const PLACEHOLDER = /^(?:<REDACTED_SECRET>|fake[_-]|test[_-]|example[_-]|sk-fake|not-a-real[-_]|SUPER-SECRET-VALUE|super-secret-value)/i;

function isPlaceholder(value) {
  return PLACEHOLDER.test(value.replace(/^Bearer\s+/i, ""));
}

/** Pure rule boundary for regression tests. Results contain no suspected value. */
export function scanLine(line) {
  const findings = [];
  for (const match of line.matchAll(ASSIGNMENT)) {
    const value = match[5] ?? match[6];
    if (!value || value.length < 12 || isPlaceholder(value) || /^NOT_AUTHORIZED\.?$/.test(value)) continue;
    // Do not confuse source field references with literal credentials.
    if (match[6] && /^(?:payload|config|self|record|request)\.[A-Za-z_][A-Za-z0-9_.]*$/.test(value)) continue;
    // A bare call is a dynamic value producer, not a literal credential.
    // Do not ignore quoted call-looking strings: those are still literal data.
    if (match[6] && line[match.index + match[0].length] === "(") continue;
    findings.push({ name: /authorization/i.test(match[2] ?? match[3]) ? "authorization" : "api_key", digest: digest(value) });
  }
  for (const match of line.matchAll(BEARER)) {
    if (!isPlaceholder(match[1])) findings.push({ name: "bearer", digest: digest(match[1]) });
  }
  for (const match of line.matchAll(PRIVATE_KEY)) {
    findings.push({ name: "private_key", digest: digest(match[0]) });
  }
  return findings;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

const REVIEW_REASONS = new Set([
  "INTENTIONALLY_INVALID_AUTH_TEST_FIXTURE",
  "GOVERNANCE_AUTHORIZATION_STATUS_PROSE",
  "HISTORICAL_GOVERNANCE_STATUS_PROSE",
]);

export function validateReviewLedger(reviewed) {
  if (!Array.isArray(reviewed)) throw new Error("invalid reviewed secret-scan ledger");
  const keys = new Set();
  for (const entry of reviewed) {
    if (!entry || typeof entry !== "object"
      || typeof entry.path !== "string" || !entry.path || entry.path.startsWith("/")
      || entry.path.split("/").some((part) => !part || part === "." || part === ".." || /[?*]/.test(part))
      || entry.path.includes("\\")
      || !["api_key", "authorization", "bearer", "private_key"].includes(entry.name)
      || typeof entry.digest !== "string" || !/^[a-f0-9]{64}$/.test(entry.digest)
      || !REVIEW_REASONS.has(entry.reason)) throw new Error("invalid reviewed secret-scan entry");
    const key = `${entry.path}\0${entry.name}\0${entry.digest}`;
    if (keys.has(key)) throw new Error("duplicate reviewed secret-scan entry");
    keys.add(key);
  }
  return reviewed;
}

/** Only the exact reviewed value/category in the exact repository path is classified. */
export function isReviewedFinding(relativePath, finding, reviewed) {
  return reviewed.some((entry) => entry.path === relativePath
    && entry.name === finding.name && entry.digest === finding.digest);
}

function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(e)) walk(p, out); }
    else if (SCAN_EXT.has(extname(p))) out.push(p);
  }
}

function main() {
  const files = [];
  walk(REBUILD, files);
  const reviewed = validateReviewLedger(JSON.parse(readFileSync(REVIEW_FILE, "utf-8")));
  let findings = 0;
  let reviewedCount = 0;
  for (const f of files) {
    const relativePath = relative(REBUILD, f).replace(/\\/g, "/");
    const lines = readFileSync(f, "utf-8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const finding of scanLine(line)) {
        const label = isReviewedFinding(relativePath, finding, reviewed) ? "REVIEWED" : "SUSPECT";
        console.warn(`${label} ${finding.name} ${relativePath}:${i + 1} fp=${finding.digest.slice(0, 12)}`);
        if (label === "REVIEWED") reviewedCount++;
        else findings++;
      }
    });
  }
  if (findings === 0) console.log(`PASS: no unreviewed suspicious values (${reviewedCount} exact reviewed match(es))`);
  else { console.error(`FAIL: ${findings} unreviewed suspicious value(s), ${reviewedCount} reviewed match(es)`); process.exitCode = 1; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
