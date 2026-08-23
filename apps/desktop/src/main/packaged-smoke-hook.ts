// PACK-005: packaged desktop runtime smoke hook (clean-room, test-support, Main only).
//
// Strictly env-gated (FASTWORK_PACKAGED_DESKTOP_SMOKE=1): a normal user run has
// zero behavior change. When enabled, it OBSERVES the normal production bootstrap
// (packaged branch, real packaged Worker, real SQLite/migrations) and writes a
// machine-readable evidence report, then exits through the normal app.quit() path.
//
// It never: mocks the Worker, mocks persistence, skips production init, opens
// Node integration, exposes raw IPC, calls a live Provider, or touches seller
// platforms. It only reads production state + attachs diagnostic listeners.
import { app, BrowserWindow, session } from "electron";
import { writeFileSync, existsSync } from "node:fs";
import { join, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AIWorkerClient } from "@fastwork/worker-rpc";
import type { MainContext } from "./bootstrap.js";
import { resolvePackagedWorkerPaths, resolvePackagedDataRoot } from "./worker-runtime.js";

export const PACKAGED_SMOKE_ENV = "FASTWORK_PACKAGED_DESKTOP_SMOKE";
export const PACKAGED_SMOKE_REPORT_ENV = "FASTWORK_PACKAGED_DESKTOP_SMOKE_REPORT";
const REPORT_VERSION = "1.0";

export function isPackagedSmokeEnabled(): boolean {
  return process.env[PACKAGED_SMOKE_ENV] === "1";
}

export function packagedSmokeReportPath(): string | null {
  return process.env[PACKAGED_SMOKE_REPORT_ENV] || null;
}

export interface PackagedSmokeReport {
  task: string;
  report_version: string;
  result: "PASS" | "FAIL";
  packaged_smoke_ok: boolean;
  startup_failed: boolean;
  app_is_packaged: boolean;
  resources_path: string;
  electron_version: string;
  main_boot_pass: boolean;
  browser_window_created: boolean;
  context_isolation: boolean;
  node_integration: boolean;
  sandbox: boolean;
  worker_state: string;
  worker_executable: string;
  worker_under_resources: boolean;
  worker_pid: number | null;
  worker_system_health_pass: boolean;
  worker_jsonl_rpc_pass: boolean;
  preload_loaded: boolean;
  preload_errors: string[];
  renderer_loaded: boolean;
  renderer_ready: boolean;
  renderer_console_errors: string[];
  render_process_gone: string[];
  did_fail_load: string[];
  raw_ipc_renderer_exposed: boolean;
  sqlite_database_path: string;
  sqlite_under_data_root: boolean;
  sqlite_database_created: boolean;
  migrations_applied: number[];
  migrations_dir_resolved: string;
  migrations_from_package: boolean;
  external_network_calls: number;
  external_network_urls: string[];
  data_root: string;
  errors: string[];
}

function baseReport(): PackagedSmokeReport {
  return {
    task: "PACK-005",
    report_version: REPORT_VERSION,
    result: "FAIL",
    packaged_smoke_ok: false,
    startup_failed: false,
    app_is_packaged: app.isPackaged === true,
    resources_path: process.resourcesPath,
    electron_version: process.versions.electron ?? "",
    main_boot_pass: false,
    browser_window_created: false,
    context_isolation: false,
    node_integration: true,
    sandbox: false,
    worker_state: "none",
    worker_executable: "",
    worker_under_resources: false,
    worker_pid: null,
    worker_system_health_pass: false,
    worker_jsonl_rpc_pass: false,
    preload_loaded: false,
    preload_errors: [],
    renderer_loaded: false,
    renderer_ready: false,
    renderer_console_errors: [],
    render_process_gone: [],
    did_fail_load: [],
    raw_ipc_renderer_exposed: true,
    sqlite_database_path: "",
    sqlite_under_data_root: false,
    sqlite_database_created: false,
    migrations_applied: [],
    migrations_dir_resolved: "",
    migrations_from_package: false,
    external_network_calls: 0,
    external_network_urls: [],
    data_root: "",
    errors: [],
  };
}

function writeReport(out: PackagedSmokeReport): void {
  const p = packagedSmokeReportPath();
  if (!p) return;
  try { writeFileSync(p, JSON.stringify(out, null, 2), "utf-8"); } catch { /* harness will notice absence */ }
}

/** Failure report for a startup abort (e.g. packaged Worker missing). */
export function writePackagedSmokeStartupFailure(error: unknown): void {
  const p = packagedSmokeReportPath();
  if (!p) return;
  const out = {
    task: "PACK-005",
    report_version: REPORT_VERSION,
    result: "FAIL",
    packaged_smoke_ok: false,
    startup_failed: true,
    error_diagnostic: String((error instanceof Error ? (error.stack ?? error.message) : error) ?? error),
    app_is_packaged: app.isPackaged === true,
    resources_path: process.resourcesPath,
    electron_version: process.versions.electron ?? "",
    errors: ["startup_failed"],
  };
  try { writeFileSync(p, JSON.stringify(out, null, 2), "utf-8"); } catch { /* noop */ }
}

async function waitFor(probe: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await probe()) return true;
    } catch { /* renderer still booting */ }
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 120));
  }
}

export interface PackagedSmokeDeps {
  window: BrowserWindow;
  workerClient: AIWorkerClient | null;
  context: MainContext | null;
}

/**
 * Observe the normal packaged bootstrap and emit evidence. Called only when
 * FASTWORK_PACKAGED_DESKTOP_SMOKE=1. Exits through the normal app.quit() path.
 */
export async function runPackagedSmokeProbe(deps: PackagedSmokeDeps): Promise<PackagedSmokeReport> {
  const out = baseReport();
  const win = deps.window;
  out.main_boot_pass = deps.context !== null && !win.isDestroyed();
  out.browser_window_created = !win.isDestroyed();
  out.worker_state = deps.workerClient?.state() ?? "none";
  out.data_root = resolvePackagedDataRoot();

  // Security values observed from the constructed window preferences.
  const prefs = (win.webContents as unknown as { getLastWebPreferences?: () => Record<string, unknown> }).getLastWebPreferences?.() ?? {};
  out.context_isolation = prefs.contextIsolation === true;
  out.node_integration = prefs.nodeIntegration === true;
  out.sandbox = prefs.sandbox === true;

  // Diagnostic listeners (window/renderer/preload).
  const wc = win.webContents;
  const on = (ev: string, cb: (...a: unknown[]) => void): void => {
    try { wc.on(ev as never, cb as never); } catch { /* optional */ }
  };
  on("preload-error", (...a: unknown[]) => {
    out.preload_errors.push(a.map((x) => String(x)).join(" "));
  });
  on("console-message", (...a: unknown[]) => {
    // Electron 32+ passes (event, details); legacy passes (event, level, message, line, sourceId).
    const first = a[0] as { level?: number; message?: string } | undefined;
    const level = typeof first === "object" && first !== null ? Number(first.level ?? -1) : Number(a[1] ?? -1);
    const message = typeof first === "object" && first !== null ? String(first.message ?? "") : String(a[2] ?? "");
    if (level >= 3 && message) out.renderer_console_errors.push(String(message).slice(0, 500));
  });
  on("render-process-gone", (...a: unknown[]) => {
    out.render_process_gone.push(a.map((x) => String(x)).join(" "));
  });
  on("did-fail-load", (...a: unknown[]) => {
    out.did_fail_load.push(a.map((x) => String(x)).join(" "));
  });

  // External network observe + deny (smoke-only; normal policy unchanged).
  // The listener stays attached until process exit (the app quits right after).
  try {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const url = String(details.url ?? "");
      if (/^(https?|wss?):/i.test(url)) {
        out.external_network_calls += 1;
        out.external_network_urls.push(url.slice(0, 300));
        callback({ cancel: true });
        return;
      }
      callback({});
    });
  } catch { /* optional */ }

  // Worker health through the REAL production client (no second worker).
  if (deps.workerClient) {
    try {
      const paths = resolvePackagedWorkerPaths(process.resourcesPath);
      out.worker_executable = paths.executable;
      out.worker_under_resources = paths.executable.startsWith(process.resourcesPath + sep);
    } catch (e) {
      out.errors.push("worker_path_resolve=" + String((e as Error)?.message ?? e));
    }
    const pid = (deps.workerClient as unknown as { process?: { pid?: number } }).process?.pid ?? null;
    out.worker_pid = pid;
    try {
      const health = (await deps.workerClient.request("system.health", {})) as { status?: string };
      out.worker_system_health_pass = health?.status === "ok";
      out.worker_jsonl_rpc_pass = health?.status === "ok";
      if (health?.status !== "ok") out.errors.push("worker_health_status=" + String(health?.status));
    } catch (e) {
      out.errors.push("worker_health=" + String((e as Error)?.message ?? e));
    }
  } else {
    out.errors.push("worker_client_missing");
  }

  // Preload + renderer readiness (reuse existing markers).
  const js = <T>(code: string): Promise<T> => wc.executeJavaScript(code, true) as Promise<T>;
  out.preload_loaded = await waitFor(
    () => js<boolean>("typeof window.fastworkDesktop === 'object' && typeof window.fastworkDesktop.bootstrap === 'function'"),
    15000,
  );
  out.renderer_loaded = await waitFor(
    () => js<boolean>("document.body !== null && document.body.dataset.booted === 'true'"),
    20000,
  );
  out.renderer_ready = await waitFor(
    () => js<boolean>("document.querySelector('#app .app-shell') !== null"),
    10000,
  );
  try {
    out.raw_ipc_renderer_exposed = await js<boolean>(
      "typeof window.ipcRenderer !== 'undefined' || typeof window.require !== 'undefined' || typeof window.process !== 'undefined'",
    );
  } catch { out.raw_ipc_renderer_exposed = true; }

  // SQLite + migrations (packaged runtime) — read the production DB under DATA_ROOT.
  const dbPath = join(resolvePackagedDataRoot(), "fast_sheep.sqlite3");
  out.sqlite_database_path = dbPath;
  out.sqlite_under_data_root = dbPath.startsWith(resolvePackagedDataRoot() + sep);
  out.sqlite_database_created = existsSync(dbPath);
  if (out.sqlite_database_created) {
    try {
      const db = new DatabaseSync(dbPath);
      const qc = db.prepare("PRAGMA quick_check").get() as { quick_check?: string };
      if (qc?.quick_check !== "ok") out.errors.push("sqlite_quick_check=" + String(qc?.quick_check));
      const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>;
      out.migrations_applied = rows.map((r) => r.version);
      db.close();
    } catch (e) {
      out.errors.push("sqlite_read=" + String((e as Error)?.message ?? e));
    }
  } else {
    out.errors.push("sqlite_database_not_created");
  }
  // Migrations directory resolved by the PACKAGED @fastwork/persistence module.
  try {
    const persistence = await import("@fastwork/persistence");
    const migDir = (persistence as { MIGRATIONS_DIR?: string }).MIGRATIONS_DIR ?? "";
    out.migrations_dir_resolved = migDir;
    out.migrations_from_package =
      migDir.startsWith(process.resourcesPath + sep) &&
      !migDir.includes("E:\\ai") &&
      !migDir.includes("packages\\persistence\\migrations");
  } catch (e) {
    out.errors.push("migrations_dir=" + String((e as Error)?.message ?? e));
  }

  // Let late renderer diagnostics surface before finalizing.
  await new Promise((r) => setTimeout(r, 1500));

  // Final result.
  out.main_boot_pass = out.main_boot_pass && !win.isDestroyed();
  const fatalRenderer = out.renderer_console_errors.length + out.render_process_gone.length + out.did_fail_load.length + out.preload_errors.length;
  const migrationsOk =
    out.migrations_applied.length >= 4 &&
    out.migrations_applied.includes(1) &&
    out.migrations_applied.includes(2) &&
    out.migrations_applied.includes(3) &&
    out.migrations_applied.includes(4);
  const ok =
    out.app_is_packaged &&
    out.main_boot_pass &&
    out.browser_window_created &&
    out.worker_state === "READY" &&
    out.worker_jsonl_rpc_pass &&
    out.worker_under_resources &&
    out.preload_loaded &&
    out.renderer_loaded &&
    out.renderer_ready &&
    !out.raw_ipc_renderer_exposed &&
    out.sqlite_database_created &&
    out.sqlite_under_data_root &&
    migrationsOk &&
    out.migrations_from_package &&
    out.external_network_calls === 0 &&
    fatalRenderer === 0 &&
    out.context_isolation &&
    !out.node_integration &&
    out.sandbox &&
    out.errors.length === 0;
  out.result = ok ? "PASS" : "FAIL";
  out.packaged_smoke_ok = ok;
  if (!ok && out.errors.length === 0) out.errors.push("smoke_checks_failed");

  writeReport(out);
  // Normal application shutdown path (before-quit stops the Worker gracefully).
  app.quit();
  return out;
}

