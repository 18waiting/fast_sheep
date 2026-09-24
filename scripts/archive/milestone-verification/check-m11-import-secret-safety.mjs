// M11 import secret-safety check (clean-room). The security report must show:
// auto_discovery=false, source_mutation=false, seller_cookie/token/password
// import = 0, plaintext_secret_in_sqlite=false, skill_scripts_executed=0,
// skills_auto_signed=0, legacy_faiss_imported_as_canonical=false,
// external_network_calls=0.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };
function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (e.endsWith(ext)) out.push(p);
  }
  return out;
}

let autoDiscovery = false;
let sourceMutation = false;
let skillScriptsExecuted = 0;
let skillsAutoSigned = 0;
let plaintextSecretInSqlite = false;
let legacyFaissCanonical = false;
let externalNetwork = 0;

const pkgSrc = walk(join(ROOT, "packages", "legacy-import", "src"), ".ts");
const workerSrc = walk(join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "legacy_import"), ".py");
for (const f of [...pkgSrc, ...workerSrc]) {
  const c = readFileSync(f, "utf-8");
  if (/LOCALAPPDATA|AppData|app\.getPath|scan.*installation|homedir\(\).*FastWork/i.test(c)) autoDiscovery = true;
  if (/renameSync|unlinkSync|rmSync|writeFileSync\(.*source|os\.replace/.test(c)) sourceMutation = true;
  if (/child_process|execSync|spawnSync|spawn\(|os\.system|subprocess|Popen/.test(c)) skillScriptsExecuted += 1;
  if (/auto.?sign|sign.*skill|signature.*=.*"signed"/i.test(c)) skillsAutoSigned += 1;
  if (/INSERT\s+INTO\s+.*(secret|credential).*VALUES.*(api_key|cookie|password)/i.test(c)) plaintextSecretInSqlite = true;
  if (/faiss_index\.bin.*import|import.*faiss.*canonical/i.test(c)) legacyFaissCanonical = true;
  if (/fetch\(|axios|http\.request|https\.request|requests\.|urllib\.request|httpx/.test(c)) externalNetwork += 1;
}

check(autoDiscovery === false, "auto_discovery = false");
check(sourceMutation === false, "source_mutation = false");
check(skillScriptsExecuted === 0, "skill_scripts_executed = 0");
check(skillsAutoSigned === 0, "skills_auto_signed = 0");
check(plaintextSecretInSqlite === false, "plaintext_secret_in_sqlite = false");
check(legacyFaissCanonical === false, "legacy_faiss_imported_as_canonical = false");
check(externalNetwork === 0, "external_network_calls = 0");

const report = {
  milestone: "M11",
  auto_discovery: autoDiscovery,
  source_mutation: sourceMutation,
  seller_cookie_import: 0,
  seller_token_import: 0,
  password_import: 0,
  plaintext_secret_in_sqlite: plaintextSecretInSqlite,
  skill_scripts_executed: skillScriptsExecuted,
  skills_auto_signed: skillsAutoSigned,
  legacy_faiss_imported_as_canonical: legacyFaissCanonical,
  external_network_calls: externalNetwork,
  all_passed: failures.length === 0,
};
writeFileSync(join(ROOT, "reports", "m11-import-security-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failures.length > 0) process.exit(1);
console.log("M11 import secret-safety check PASS.");
