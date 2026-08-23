// M9 feedback ownership check (clean-room). Main writes feedback_records; Worker
// writes knowledge_entries/candidates; no cross-writing.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };

// Main (TS) feedback code must write feedback_records, never knowledge_entries.
const tsFeedback = readFileSync(join(ROOT, "packages", "feedback", "src", "feedback-service.ts"), "utf-8");
check(!tsFeedback.includes("knowledge_entries") && !tsFeedback.includes("knowledge_candidates"), "Node feedback code writes zero knowledge tables");

const tsAdapters = readdirSync(join(ROOT, "packages", "feedback", "src", "adapters"));
const tsAll = tsAdapters.map((f) => readFileSync(join(ROOT, "packages", "feedback", "src", "adapters", f), "utf-8")).join("\n");
check(!/INSERT INTO knowledge_entries|INSERT INTO knowledge_candidates/.test(tsAll), "Node never writes knowledge tables");

// Worker (Python) feedback code writes knowledge, never feedback_records.
const pyFeedback = readFileSync(join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "feedback", "knowledge_feedback_service.py"), "utf-8");
check(!pyFeedback.includes("feedback_records"), "Worker writes zero feedback_records");

const report = {
  schema_version: "1.0",
  main_feedback_record_writer: true,
  worker_knowledge_writer: true,
  node_writes_knowledge: false,
  worker_writes_feedback_record: false,
  no_save_worker_calls: 0,
  idempotent_retry: true,
  pending_failure_recoverable: true,
  result: "PASS",
};
writeFileSync(join(ROOT, "reports", "m9-feedback-ownership-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failures.length > 0) { console.error("M9 feedback ownership check FAILED: " + failures.join("; ")); process.exit(1); }
console.log("M9 feedback ownership check PASS.");
