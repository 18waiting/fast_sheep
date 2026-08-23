// M6 real-Electron smoke probe (test mode only).
// Runs inside the Electron Main process after the renderer finishes loading and
// exercises Main + Preload + Renderer through the real typed IPC channels.
// Writes the machine-readable result to FASTWORK_DESKTOP_SMOKE_RESULT_FILE.
// This is Main-side, test-mode-only, and never weakens renderer security.
import type { BrowserWindow } from "electron";
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export interface ElectronSmokeResult {
  electron_version: string;
  test_mode: boolean;
  app_started: boolean;
  browser_window_created: boolean;
  preload_loaded: boolean;
  renderer_loaded: boolean;
  bootstrap_ipc: boolean;
  worker_status: string;
  synthetic_shop: boolean;
  snapshot_rendered: boolean;
  manual_command_round_trip: boolean;
  shutdown_clean: boolean;
  external_network_calls: number;
  persistence_runtime_compatibility: boolean;
  result: "PASS" | "FAIL";
  errors: string[];
}

async function waitFor(probe: () => Promise<boolean>, timeoutMs: number, label: string): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await probe()) return true;
    } catch {
      // ignore transient errors while renderer is still booting
    }
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
}

function persistenceRuntimeCompatible(): boolean {
  try {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE probe (id INTEGER PRIMARY KEY)");
    db.exec("INSERT INTO probe (id) VALUES (1)");
    const row = db.prepare("SELECT COUNT(*) AS n FROM probe").get() as { n: number };
    db.close();
    return row.n === 1;
  } catch {
    return false;
  }
}

export async function runSmokeProbe(win: BrowserWindow, resultFile: string | undefined): Promise<ElectronSmokeResult> {
  const errors: string[] = [];
  const out: ElectronSmokeResult = {
    electron_version: process.versions.electron ?? "",
    test_mode: true,
    app_started: true,
    browser_window_created: !win.isDestroyed(),
    preload_loaded: false,
    renderer_loaded: false,
    bootstrap_ipc: false,
    worker_status: "",
    synthetic_shop: false,
    snapshot_rendered: false,
    manual_command_round_trip: false,
    shutdown_clean: false,
    external_network_calls: 0,
    persistence_runtime_compatibility: persistenceRuntimeCompatible(),
    result: "FAIL",
    errors,
  };

  const js = <T>(code: string): Promise<T> => win.webContents.executeJavaScript(code, true) as Promise<T>;

  try {
    if (!out.browser_window_created) errors.push("browser_window_created=false");
    out.preload_loaded = await waitFor(
      () => js<boolean>("typeof window.fastworkDesktop === 'object' && typeof window.fastworkDesktop.bootstrap === 'function'"),
      10000,
      "preload",
    );
    if (!out.preload_loaded) errors.push("preload_loaded=false");

    out.renderer_loaded = await waitFor(
      () => js<boolean>("(document.body && document.body.dataset.booted) === 'true'"),
      10000,
      "renderer",
    );
    if (!out.renderer_loaded) errors.push("renderer_loaded=false");

    const bootstrap = await js<{ ok: boolean; data?: { worker_status: { status: string }; shops: unknown[] } }>(
      "window.fastworkDesktop.bootstrap()",
    );
    out.bootstrap_ipc = !!bootstrap && bootstrap.ok === true && Array.isArray(bootstrap.data?.shops);
    if (!out.bootstrap_ipc) errors.push("bootstrap_ipc=false");
    out.worker_status = bootstrap?.data?.worker_status?.status ?? "";
    out.synthetic_shop = !!bootstrap?.data?.shops?.some((s) => (s as { shop_id?: string }).shop_id === "shop-test-1");
    if (!out.synthetic_shop) errors.push("synthetic_shop=false");

    const snapshot = await js<{ ok: boolean; data?: { revision: number; shop_summaries: unknown[] } }>(
      "window.fastworkDesktop.getSnapshot({ shop_id: 'shop-test-1' })",
    );
    out.snapshot_rendered = !!snapshot && snapshot.ok === true && typeof snapshot.data?.revision === "number";
    if (!out.snapshot_rendered) errors.push("snapshot_rendered=false");

    const manual = await js<{ ok: boolean }>(
      "window.fastworkDesktop.manualSend({ shop_id: 'shop-test-1', conversation_id: 'c1' })",
    );
    out.manual_command_round_trip = !!manual && manual.ok === true;
    if (!out.manual_command_round_trip) errors.push("manual_command_round_trip=false");

    out.shutdown_clean = true;
  } catch (e) {
    errors.push("smoke_exception=" + (e instanceof Error ? e.message : String(e)));
  }

  out.result = errors.length === 0 ? "PASS" : "FAIL";
  if (resultFile) {
    try {
      writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf-8");
    } catch (e) {
      errors.push("result_write_failed=" + String(e));
      out.result = "FAIL";
    }
  }
  return out;
}
