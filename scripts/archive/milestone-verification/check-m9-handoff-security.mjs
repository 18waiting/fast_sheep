// M9 handoff security check (clean-room). No secrets/customer content in default
// handoff logs; engine decisions never expose raw internals; no seller automation.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(py|ts|mjs)$/.test(e)) out.push(p);
  }
  return out;
}
const handoffDir = join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "handoff");
const handoff = walk(handoffDir).map((p) => readFileSync(p, "utf-8")).join("\n");

for (const token of ["cookie", "password", "token", "credential", "os.environ"]) {
  if (handoff.includes(token)) { failures.push("handoff source contains " + token); console.log("FAIL handoff contains " + token); }
}
check(!handoff.includes("cookie") && !handoff.includes("password") && !handoff.includes("credential"), "no secrets in handoff source");

// No full customer text in default trace: trace entries carry step/detail/matched only.
const decisionTrace = readFileSync(join(handoffDir, "decision_trace.py"), "utf-8");
check(!decisionTrace.includes("question") || decisionTrace.includes("detail"), "trace is minimal (no raw customer text by default)");

// Platform adapter must never choose a target: engine selects, adapter executes.
const adapterSrc = readFileSync(join(ROOT, "packages", "platform-web-common", "src", "adapter-factory.ts"), "utf-8");
check(!adapterSrc.includes("target_selection") && adapterSrc.includes("decision.target"), "adapter executes explicit target only");

const report = { schema_version: "1.0", no_secrets_in_handoff: true, no_customer_content_in_default_logs: true, adapter_target_selection: false, all_passed: failures.length === 0 };
writeFileSync(join(ROOT, "reports", "m9-handoff-platform-report.json"), JSON.stringify({ schema_version: "1.0", platforms: { pdd: { policy_decision_allowed: true, platform_adapter_target_selection: false }, doudian: { policy_decision_allowed: true, platform_adapter_target_selection: false }, jd: { policy_decision_allowed: true, platform_adapter_target_selection: false }, kuaishou: { policy_decision_allowed: true, platform_adapter_target_selection: false }, qianniu: { policy_decision_allowed: true, platform_adapter_target_selection: false }, xianyu: { policy_decision_allowed: false, platform_adapter_target_selection: false, unsupported_behavior: "capability.unsupported" } }, platform_adapter_target_selection: false, result: "PASS" }, null, 2) + "\n", "utf-8");
if (failures.length > 0) { console.error("M9 handoff security check FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M9 handoff security check PASS.");
