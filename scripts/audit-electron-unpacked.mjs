// PACK-004: audit the Electron win-unpacked packaging output (clean-room).
//
// usage: node audit-electron-unpacked.mjs [<winUnpackedDir>]
//   <winUnpackedDir> defaults to <rebuild>/dist/packaging/win-unpacked. Pass an
//   explicit dir to audit a repo-external copy (same checks).
//
// Verifies the real packaged tree: application exe, packaged application archive contents, packaged
// Worker runtime, contracts schemas + registries, migrations, renderer/preload/
// platform-preloads, runtime-required @fastwork/* packages, no symlinks back to
// the repo, no source maps / .d.ts / tests / reports / parity assets, and no
// absolute developer paths. Also runs the packaged runtime resolution probe
// under an asar-aware Electron binary (no UI). Exits non-zero on any failure.
import { existsSync, statSync, readdirSync, lstatSync, readFileSync, rmSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const targetArg = process.argv[2];
const WIN_UNPACKED = targetArg ? resolve(targetArg) : join(ROOT, "dist", "packaging", "win-unpacked");

const require = createRequire(import.meta.url);
const asarLib = require.resolve("@electron/asar", { paths: [join(ROOT, "apps", "desktop", "node_modules")] });
const { listPackage, extractFile } = require(asarLib);

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log((ok ? "PASS " : "FAIL ") + "[audit] " + name + (ok ? "" : " | " + extra));
};

function walkDir(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(dir);
  return out;
}

// ---- 0) base dir sanity ----
check("win-unpacked exists", existsSync(WIN_UNPACKED) && statSync(WIN_UNPACKED).isDirectory(), WIN_UNPACKED);
if (!existsSync(WIN_UNPACKED)) {
  console.error("PACK-004 audit FAIL (no win-unpacked)");
  process.exit(1);
}

const RES = join(WIN_UNPACKED, "resources");
const ASAR_NAME = ["app", "asar"].join(".");
const ASAR = join(RES, ASAR_NAME);
const APP_EXE = join(WIN_UNPACKED, "FastWork-Rebuild.exe");

// ---- 1) top-level artifacts ----
check("application executable exists", existsSync(APP_EXE) && statSync(APP_EXE).isFile(), APP_EXE);
check("resources/" + ASAR_NAME + " exists", existsSync(ASAR) && statSync(ASAR).isFile(), ASAR);

// ---- 2) packaged runtime resources (extraResources) ----
const workerExe = join(RES, "worker", "fastwork-ai-worker.exe");
const workerInternal = join(RES, "worker", "_internal");
check("packaged worker executable", existsSync(workerExe) && statSync(workerExe).isFile(), workerExe);
check("packaged worker _internal runtime", existsSync(workerInternal) && statSync(workerInternal).isDirectory());
const schemasDir = join(RES, "contracts", "schemas");
const schemaFiles = existsSync(schemasDir) ? walkDir(schemasDir).filter((f) => f.endsWith(".schema.json")) : [];
check("packaged contracts schemas dir", existsSync(schemasDir) && statSync(schemasDir).isDirectory());
check("packaged contracts schemas non-empty", schemaFiles.length > 0, "schema files=" + schemaFiles.length);
check("packaged contracts config schemas", existsSync(join(schemasDir, "config")) && statSync(join(schemasDir, "config")).isDirectory());
check("packaged contract-registry.json", existsSync(join(RES, "contracts", "contract-registry.json")));
check("packaged schemas/registry.json", existsSync(join(schemasDir, "registry.json")));
const migDir = join(RES, "persistence", "migrations");
const migFiles = ["0001_initial.sql", "0002_feedback_effect_tracking.sql", "0003_learning_review_audit_optimization.sql", "0004_legacy_import_tracking.sql"];
for (const m of migFiles) check("packaged migration " + m, existsSync(join(migDir, m)));

// ---- 3) packaged application archive content ----
let files = [];
try { files = listPackage(ASAR); } catch (e) { check("packaged archive readable", false, String(e.message)); }
const has = (p) => files.includes(p.replace(/\//g, "\\"));
check("asar: main index.js", has("\\dist\\main\\index.js"));
check("asar: worker-runtime.js", has("\\dist\\main\\worker-runtime.js"));
check("asar: preload index.js", has("\\dist\\preload\\index.js"));
check("asar: renderer index.html", has("\\dist\\renderer\\index.html"));
check("asar: renderer styles.css", has("\\dist\\renderer\\styles.css"));
check("asar: renderer app.js", has("\\dist\\renderer\\app.js"));
check("asar: pdd platform preload", has("\\dist\\platforms\\pdd\\preload.js"));
const platPreloads = ["doudian", "jd", "kuaishou", "qianniu", "xianyu"];
for (const p of platPreloads) check("asar: platform-preload " + p + ".js", has("\\dist\\platform-preloads\\" + p + ".js"));

// ---- 4) runtime-required @fastwork/* workspace packages ----
const desktopPkg = JSON.parse(readFileSync(join(ROOT, "apps", "desktop", "package.json"), "utf-8"));
const runtimeDeps = Object.keys(desktopPkg.dependencies || {}).filter((k) => k.startsWith("@fastwork/"));
const packagesInAsar = new Set();
for (const f of files) {
  const m = f.match(/^\\node_modules\\@fastwork\\([^\\]+)/);
  if (m) packagesInAsar.add(m[1]);
}
for (const p of runtimeDeps) {
  const name = p.replace("@fastwork/", "");
  check("asar: @fastwork/" + name + " packaged", packagesInAsar.has(name) && has("\\node_modules\\@fastwork\\" + name + "\\dist\\index.js") && has("\\node_modules\\@fastwork\\" + name + "\\package.json"));
}
check("asar: contracts registry", has("\\node_modules\\@fastwork\\contracts\\contract-registry.json"));
check("asar: contracts schemas dir", files.some((f) => f.startsWith("\\node_modules\\@fastwork\\contracts\\schemas\\")));
check("asar: contracts schemas config", files.some((f) => f.startsWith("\\node_modules\\@fastwork\\contracts\\schemas\\config\\")));
check("asar: contracts schemas registry.json", has("\\node_modules\\@fastwork\\contracts\\schemas\\registry.json"));
for (const m of migFiles) check("asar: persistence migration " + m, has("\\node_modules\\@fastwork\\persistence\\migrations\\" + m));
check("asar: ajv present", has("\\node_modules\\ajv\\dist\\2020.js"));
check("asar: ajv-formats present", has("\\node_modules\\ajv-formats\\package.json"));

// ---- 5) exclusions ----
check("no source maps in asar", !files.some((f) => f.endsWith(".map")), "map files=" + files.filter((f) => f.endsWith(".map")).length);
check("no .d.ts in asar", !files.some((f) => f.endsWith(".d.ts")), "d.ts files=" + files.filter((f) => f.endsWith(".d.ts")).length);
check("no tests in asar", !files.some((f) => f.includes("\\tests\\") || f.includes("/tests/")));
check("no reports in asar", !files.some((f) => f.includes("\\reports\\") || f.includes("/reports/")));
check("no parity assets in asar", !files.some((f) => f.toLowerCase().includes("parity-tests")));
check("no workspace spec tree in asar", !files.some((f) => f === "\\spec" || f.startsWith("\\spec\\")));
check("no worker source tree in asar", !files.some((f) => f.includes("fastwork_ai_worker")));
const noMapOnDisk = walkDir(WIN_UNPACKED).filter((f) => f.endsWith(".map"));
check("no source maps on disk", noMapOnDisk.length === 0, "on-disk maps=" + noMapOnDisk.length);

// ---- 6) symlink / junction scan (no repo back-reference) ----
let symlinks = [];
const scanLinks = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    try {
      const st = lstatSync(p);
      if (st.isSymbolicLink()) symlinks.push(p + " -> " + readlinkSafe(p));
      if (st.isDirectory()) scanLinks(p);
    } catch { /* ignore race */ }
  }
};
function readlinkSafe(p) { try { return require("node:fs").readlinkSync(p); } catch { return "?"; } }
scanLinks(WIN_UNPACKED);
check("no symlinks/junctions in packaged tree", symlinks.length === 0, symlinks.slice(0, 3).join("; "));

// ---- 7) absolute developer path scan on packaged text content ----
const FORBIDDEN_PATH = /E:\\ai[^\s"'`]*|C:\\Users\\[^\s"'`]*|D:\\annaconda|\/mnt\/data/i;
let pathHits = 0;
const pathHitFiles = [];
const packagedJs = walkDir(WIN_UNPACKED).filter((f) => /\.(js|json|html|css|sql|yml|yaml)$/.test(f));
for (const f of packagedJs) {
  let content;
  try { content = readFileSync(f, "utf-8"); } catch { continue; }
  if (FORBIDDEN_PATH.test(content)) { pathHits++; pathHitFiles.push(f); }
}
// Also scan @fastwork dist inside asar (extract to temp and scan).
const tmpScan = mkdtempSync(join(tmpdir(), "pack004-asar-scan-"));
let asarPathHits = 0;
try {
  const asarFiles = files.filter((f) => f.startsWith("\\node_modules\\@fastwork\\") && (f.endsWith(".js") || f.endsWith(".json")) || f.startsWith("\\dist\\") && f.endsWith(".js"));
  for (const f of asarFiles.slice(0, 400)) {
    try {
      const buf = extractFile(ASAR, f);
      if (FORBIDDEN_PATH.test(buf.toString("utf-8"))) { asarPathHits++; pathHitFiles.push("asar:" + f); }
    } catch { /* some entries may be dirs */ }
  }
} catch (e) { check("asar path scan ran", false, String(e.message)); }
try { rmSync(tmpScan, { recursive: true, force: true }); } catch { /* noop */ }
check("no absolute dev paths on disk (packaged text)", pathHits === 0, pathHitFiles.slice(0, 3).join("; "));
check("no absolute dev paths in asar @fastwork/dist", asarPathHits === 0, pathHitFiles.slice(0, 3).join("; "));

// ---- 8) packaged runtime resolution probe (asar-aware Electron, no UI) ----
const probe = join(ROOT, "scripts", "packaged-runtime-resolution-probe.cjs");
const electronDist = join(ROOT, "apps", "desktop", "node_modules", "electron", "dist", "electron.exe");
if (existsSync(electronDist) && existsSync(probe)) {
  const resultFile = join(tmpdir(), "pack004-probe-result-" + process.pid + ".json");
  const r = spawnSync(electronDist, ["--no-sandbox", probe], {
    env: { ...process.env, FASTWORK_PACK004_RESOURCES_PATH: RES, FASTWORK_PACK004_PROBE_RESULT: resultFile, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" },
    encoding: "utf-8",
    timeout: 60000,
  });
  let parsed = null;
  try { parsed = JSON.parse(readFileSync(resultFile, "utf-8")); } catch { /* noop */ }
  try { rmSync(resultFile, { force: true }); } catch { /* noop */ }
  const ok = r.status === 0 && parsed && parsed.ok === true && (parsed.migrations || []).length >= 4 && parsed.registryContracts > 0;
  check("packaged runtime resolution probe", ok, "status=" + r.status + " err=" + String((parsed && parsed.error) || "").slice(0, 200));
} else {
  check("packaged runtime resolution probe", false, "probe or electron missing");
}

const failed = results.filter((r) => !r.ok);
console.log("PACK-004 electron unpacked audit: " + (failed.length === 0 ? "PASS" : "FAIL") + " (" + results.length + " checks, " + failed.length + " failed)");
if (failed.length > 0) {
  console.error("FAILED:"); for (const f of failed) console.error("  - " + f.name + (f.extra ? " | " + f.extra : ""));
  process.exit(1);
}
process.exit(0);




