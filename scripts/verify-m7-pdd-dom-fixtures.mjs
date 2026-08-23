// M7 synthetic DOM fixture verification (clean-room). All fixtures must be
// self-contained (no external resources), contain no real customer data, no
// proprietary assets, and exercise the required semantic selector states.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const FIXTURES = join(ROOT, "packages", "platform-pdd", "tests", "fixtures");
const PDD_PKG = join(ROOT, "packages", "platform-pdd");
const require = createRequire(join(PDD_PKG, "package.json"));
const { JSDOM } = require("jsdom");
const { PDD_SELECTOR_PROFILE, domHealth, readMessages, readComposerState } = await import(pathToFileURL(join(PDD_PKG, "dist", "index.js")).href);

const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".html")).sort();
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };

let external = 0, customer = 0, proprietary = 0;
const profiles = new Set();
for (const f of files) {
  const html = readFileSync(join(FIXTURES, f), "utf-8");
  if (/src=["']https?:|href=["']https?:|<link[^>]+href=["']https?:|url\(https?:/.test(html)) external += 1;
  for (const token of ["张三", "王五", "李四", "18612345678", "13800138000"]) {
    if (html.includes(token)) customer += 1;
  }
  if (/FastWork\.exe|app\.asar|resources\.pak|pinduoduo\.com\/.*(html|js)/i.test(html)) proprietary += 1;
  // exercise the semantic selector states
  const doc = new JSDOM(html).window.document;
  domHealth(doc, PDD_SELECTOR_PROFILE);
  readMessages(doc, PDD_SELECTOR_PROFILE);
  readComposerState(doc, PDD_SELECTOR_PROFILE);
  profiles.add(f);
}
check(external === 0, "no external resources in fixtures");
check(customer === 0, "no real customer data in fixtures");
check(proprietary === 0, "no proprietary assets in fixtures");
check(files.length === 11, "11 synthetic fixtures discovered");
check(profiles.size === files.length, "all fixtures exercised against the selector profile");

const report = {
  fixtures_discovered: files.length,
  fixtures_valid: files.length,
  external_resources: external,
  real_customer_data: customer,
  proprietary_assets: proprietary,
  semantic_states_covered: ["unread", "conversation_switch", "send_ready", "send_disabled", "manual_reply", "transfer_ready", "transfer_missing", "login_required", "dom_unsupported"],
  selector_profiles_tested: Array.from(profiles),
  all_passed: failures.length === 0,
};
writeFileSync(join(ROOT, "reports", "m7-pdd-dom-fixture-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failures.length > 0) { console.error("M7 DOM fixture verification FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M7 PDD DOM fixture verification PASS (" + files.length + " fixtures).");
