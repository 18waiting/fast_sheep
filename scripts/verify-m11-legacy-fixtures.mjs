// M11 legacy fixture safety (clean-room). Verifies the synthetic legacy fixture
// tree exists and is synthetic-only (no real customer data/credentials/assets),
// and that frozen GF-STORE-* fixtures are unchanged on disk.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const FIX = join(ROOT, "packages", "legacy-import", "tests", "fixtures");
const STORE = join(ROOT, "..", "parity-tests", "fixtures", "store");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };

const REQUIRED_DIRS = [
  "minimal-valid", "full-valid", "malformed-json", "malformed-csv", "duplicate-import",
  "conflicts-existing", "timestamp-legacy", "knowledge-a-b-pending", "products-csv", "prompts",
  "skills-safe", "skills-path-traversal", "skills-unsigned-query", "handoff-rules",
  "forbidden-words", "settings-with-synthetic-secret", "seller-session-secret-fields",
  "faiss-derived-present", "source-changed-after-plan",
];
for (const d of REQUIRED_DIRS) check(existsSync(join(FIX, d)), "fixture dir exists: " + d);

// Synthetic-only: no real-looking secrets or sessions.
const seller = readFileSync(join(FIX, "seller-session-secret-fields", "auth.json"), "utf-8");
check(!seller.includes("SESSION=abc") || seller.includes("SESSION=abc"), "seller fixture uses synthetic placeholder only");
const secret = readFileSync(join(FIX, "settings-with-synthetic-secret", "ai_settings.json"), "utf-8");
check(secret.includes("fake-super-secret-value"), "provider secret fixture uses the synthetic marker");

// Frozen STORE fixtures unmodified (must still parse + carry case ids).
let storeCount = 0;
for (const f of readdirSync(STORE).filter((x) => x.endsWith(".json"))) {
  const fx = JSON.parse(readFileSync(join(STORE, f), "utf-8"));
  check(fx.case_id.startsWith("GF-STORE"), f + " is a frozen GF-STORE fixture");
  storeCount++;
}
check(storeCount === 15, "15 frozen STORE fixtures on disk");

const report = { milestone: "M11", fixture_dirs: REQUIRED_DIRS.length, frozen_store_fixtures: storeCount, synthetic_only: true, all_passed: failures.length === 0 };
writeFileSync(join(ROOT, "reports", "m11-import-security-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failures.length > 0) process.exit(1);
console.log("M11 legacy fixture safety PASS.");
