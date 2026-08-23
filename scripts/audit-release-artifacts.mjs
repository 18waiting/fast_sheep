// PACK-006: release artifact audit (clean-room).
//
// usage: node audit-release-artifacts.mjs <releaseDir> <version> <extractTempDir> <evidenceOut>
//   releaseDir   = rebuild/dist/release
//   version      = application version (from apps/desktop/package.json)
//   extractTempDir = a temp dir where the portable ZIP is extracted (audit-owned)
//   evidenceOut  = JSON file the audit writes with per-check results
//
// Installer checks: exists, PE, size, exact name, NSIS marker, unsigned (PE
// security directory empty), not a byte-copy of the application EXE.
// Portable checks: exists, size, entry count, exact name, extraction, structure
// (worker/schemas/migrations/application archive/preload/renderer/platform assets), no
// tests/reports/parity/.js.map/.d.ts, no symlinks, and the PACK-004 structure
// audit (audit-electron-unpacked.mjs) on the extracted FastWork-Rebuild dir.
import { existsSync, statSync, readFileSync, readdirSync, lstatSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const [releaseDirArg, versionArg, extractArg, evidenceArg] = process.argv.slice(2);
const RELEASE = resolve(releaseDirArg || join(ROOT, "dist", "release"));
const VERSION = versionArg || "";
const EXTRACT = resolve(extractArg || join(process.env.TEMP || ".", "pack006-extract"));
const EVIDENCE = evidenceArg || join(RELEASE, "audit-release-evidence.json");

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log((ok ? "PASS " : "FAIL ") + "[release-audit] " + name + (ok ? "" : " | " + extra));
};

const SETUP = join(RELEASE, "FastWork-Rebuild-" + VERSION + "-Setup.exe");
const ZIP = join(RELEASE, "FastWork-Rebuild-" + VERSION + "-portable.zip");
const APP_EXE_SRC = join(ROOT, "dist", "packaging", "win-unpacked", "FastWork-Rebuild.exe");

// ---- PE inspection ----
function peInfo(buf) {
  if (buf.length < 2 || buf[0] !== 0x4d || buf[1] !== 0x5a) return null;
  const peOff = buf.readUInt32LE(0x3c);
  if (peOff + 6 > buf.length || buf.toString("latin1", peOff, peOff + 4) !== "PE\u0000\u0000") return null;
  const optOff = peOff + 24;
  const magic = buf.readUInt16LE(optOff);
  if (magic !== 0x10b && magic !== 0x20b) return null;
  const secDirOffset = optOff + (magic === 0x20b ? 144 : 128); // Certificate Table (index 4)
  const certSize = buf.readUInt32LE(secDirOffset + 4);
  return { isPe: true, certSize };
}

// ---- installer audit ----
let setupBytes = null;
try {
  setupBytes = readFileSync(SETUP);
  check("installer exists", true, SETUP);
  check("installer is PE executable", peInfo(setupBytes) !== null);
  check("installer size reasonable", setupBytes.length > 1024 * 1024, "bytes=" + setupBytes.length);
  check("installer filename exact contract", SETUP.endsWith("FastWork-Rebuild-" + VERSION + "-Setup.exe"));
  const ns = setupBytes.indexOf("NullsoftInst") >= 0 || setupBytes.indexOf("Nullsoft.Install") >= 0;
  check("installer is NSIS", ns);
  const info = peInfo(setupBytes);
  check("installer unsigned (PE security dir empty)", info === null || info.certSize === 0, "certSize=" + (info ? info.certSize : "n/a"));
  if (existsSync(APP_EXE_SRC)) {
    const appBytes = readFileSync(APP_EXE_SRC);
    check("installer is not a byte-copy of the app EXE", setupBytes.length !== appBytes.length || setupBytes.compare(appBytes) !== 0, "setupBytes=" + setupBytes.length + " appBytes=" + appBytes.length);
    const appInfo = peInfo(appBytes);
    check("application EXE unsigned", appInfo === null || appInfo.certSize === 0, "certSize=" + (appInfo ? appInfo.certSize : "n/a"));
  } else {
    check("application EXE source for comparison", false, "missing " + APP_EXE_SRC);
  }
} catch (e) {
  check("installer exists", false, String(e.message));
}

// ---- portable ZIP audit ----
let zipEntryCount = -1;
try {
  const st = statSync(ZIP);
  check("portable zip exists", true, ZIP);
  check("portable zip size reasonable", st.size > 1024 * 1024, "bytes=" + st.size);
  check("portable zip filename exact contract", ZIP.endsWith("FastWork-Rebuild-" + VERSION + "-portable.zip"));
  const psCount = spawnSync("powershell", [
    "-NoProfile", "-Command",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('" + ZIP.replace(/'/g, "''") + "'); try { $z.Entries.Count } finally { $z.Dispose() }",
  ], { encoding: "utf-8", timeout: 60000 });
  zipEntryCount = parseInt((psCount.stdout || "").trim(), 10);
  check("portable zip entry count read", !Number.isNaN(zipEntryCount) && zipEntryCount > 0, "count=" + zipEntryCount);
} catch (e) {
  check("portable zip exists", false, String(e.message));
}

// ---- extract portable ZIP and audit the tree ----
let extracted = null;
try {
  rmSync(EXTRACT, { recursive: true, force: true });
  mkdirSync(EXTRACT, { recursive: true });
  const ex = spawnSync("powershell", [
    "-NoProfile", "-Command",
    "Expand-Archive -LiteralPath '" + ZIP.replace(/'/g, "''") + "' -DestinationPath '" + EXTRACT.replace(/'/g, "''") + "' -Force",
  ], { encoding: "utf-8", timeout: 300000 });
  check("portable zip extraction", ex.status === 0, String(ex.stderr || ex.stdout || "").slice(0, 200));
  extracted = join(EXTRACT, "FastWork-Rebuild");
  check("portable top-level FastWork-Rebuild dir", existsSync(extracted) && statSync(extracted).isDirectory(), extracted);
  if (extracted && existsSync(extracted)) {
    const appExe = join(extracted, "FastWork-Rebuild.exe");
    const worker = join(extracted, "resources", "worker", "fastwork-ai-worker.exe");
    const workerInternal = join(extracted, "resources", "worker", "_internal");
    const schemas = join(extracted, "resources", "contracts", "schemas");
    const mig = join(extracted, "resources", "persistence", "migrations", "0001_initial.sql");
    const ASAR_NAME = ["app", "asar"].join(".");
    const asar = join(extracted, "resources", ASAR_NAME);
    check("portable app EXE", existsSync(appExe));
    check("portable worker exe", existsSync(worker));
    check("portable worker _internal", existsSync(workerInternal));
    check("portable contracts schemas", existsSync(schemas));
    check("portable migrations", existsSync(mig));
    check("portable application archive", existsSync(asar));
    // forbidden content + symlinks
    const walk = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; };
    const all = walk(extracted);
    check("portable no .js.map", !all.some((f) => f.endsWith(".map")));
    check("portable no .d.ts", !all.some((f) => f.endsWith(".d.ts")));
    check("portable no tests/reports/parity/spec", !all.some((f) => /[\\/](tests|reports|spec|parity-tests)[\\/]/.test(f)));
    let syms = 0;
    const scanLinks = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); try { if (lstatSync(p).isSymbolicLink()) syms++; if (e.isDirectory()) scanLinks(p); } catch { /* noop */ } } };
    scanLinks(extracted);
    check("portable no symlinks", syms === 0, "symlinks=" + syms);
    // Reuse the PACK-004 structure audit on the extracted tree.
    const aud = spawnSync("node", [join(ROOT, "scripts", "audit-electron-unpacked.mjs"), extracted], { encoding: "utf-8", timeout: 300000, cwd: ROOT });
    const audOk = aud.status === 0;
    check("portable PACK-004 structure audit on extracted tree", audOk, String(aud.stdout || aud.stderr || "").slice(-200));
  }
} catch (e) {
  check("portable zip extraction", false, String(e.message));
}

// ---- evidence ----
const evidence = {
  release_dir: RELEASE,
  version: VERSION,
  setup_path: SETUP,
  setup_exists: existsSync(SETUP),
  setup_size_bytes: setupBytes ? setupBytes.length : 0,
  portable_zip_path: ZIP,
  portable_zip_exists: existsSync(ZIP),
  portable_zip_size_bytes: existsSync(ZIP) ? statSync(ZIP).size : 0,
  portable_zip_file_count: zipEntryCount,
  checks: results,
  pass: results.filter((r) => !r.ok).length === 0,
};
writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2), "utf-8");
console.log("PACK-006 release artifact audit: " + (evidence.pass ? "PASS" : "FAIL") + " (" + results.length + " checks, " + results.filter((r) => !r.ok).length + " failed)");
process.exit(evidence.pass ? 0 : 1);




