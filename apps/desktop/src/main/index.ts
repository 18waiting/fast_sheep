// M6 Electron Main entry: window policy, bootstrap, typed IPC, event bridges, app lifecycle.
import { app, BrowserWindow, session, type WebContents } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { windowPolicy, CSP, isNavigationAllowed } from "./window-policy.js";
import { createMainContext } from "./bootstrap.js";
import { registerIpc, broadcast } from "./ipc/register-ipc.js";
import { OrchestratorEventBridge } from "./events/orchestrator-event-bridge.js";
import { WorkerStatusEventBridge } from "./events/worker-status-event-bridge.js";
import { ShopEventBridge } from "./events/shop-event-bridge.js";
import { isTestMode } from "./test-mode.js";
import { runSmokeProbe } from "./smoke-probe.js";
import { runPddSmokeProbe, runPddSessionIsolationProbe } from "./smoke-probe-pdd.js";
import { runM8PlatformProbe, runM8MultiPlatformProbe, runM8VerticalProbe } from "./smoke-probe-m8.js";
import { AIWorkerClient } from "@fastwork/worker-rpc";
import { createPackagedWorkerClient, resolvePackagedDataRoot, createWorkerBackedMainContext } from "./worker-runtime.js";
import { isPackagedSmokeEnabled, runPackagedSmokeProbe, writePackagedSmokeStartupFailure } from "./packaged-smoke-hook.js";
import { registerPddPageIpc, PDD_PAGE_EVENT_CHANNEL, PDD_PAGE_COMMAND_RESULT_CHANNEL } from "./platforms/pdd/pdd-page-ipc.js";
import { registerDoudianPageIpc } from "./platforms/doudian/doudian-page-ipc.js";
import { registerJDPageIpc } from "./platforms/jd/jd-page-ipc.js";
import { registerKuaishouPageIpc } from "./platforms/kuaishou/kuaishou-page-ipc.js";
import { registerQianniuPageIpc } from "./platforms/qianniu/qianniu-page-ipc.js";
import { registerXianyuPageIpc } from "./platforms/xianyu/xianyu-page-ipc.js";
import { IPC } from "@fastwork/desktop-ipc";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRELOAD = join(HERE, "..", "preload", "index.js");
const RENDERER_HTML = join(HERE, "..", "renderer", "index.html");
const FILE_ORIGIN = "file://";

// Fast Sheep product identity: stable ASCII userData path (display name is Chinese).
app.setName("fast_sheep");
app.setPath("userData", join(app.getPath("appData"), "fast_sheep"));

let mainWindow: BrowserWindow | null = null;
let context: ReturnType<typeof createMainContext> | null = null;
let bridges: Array<{ stop(): void }> = [];
let stopPddPageIpc: (() => void) | null = null;
let workerClient: AIWorkerClient | null = null;

function denyWebview(event: Electron.Event): void {
  event.preventDefault();
}

function createWindow(): BrowserWindow {
  const policy = windowPolicy(PRELOAD);
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: policy.webPreferences,
  });

  // External navigation / new windows / webviews are denied by default.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!isNavigationAllowed(url, FILE_ORIGIN)) event.preventDefault();
  });
  win.webContents.on("will-attach-webview", denyWebview);

  void win.loadFile(RENDERER_HTML);
  win.once("ready-to-show", () => { if (!isTestMode()) win.show(); });
  win.on("closed", () => { mainWindow = null; });

  // Test-mode real-Electron smoke probe (Main + Preload + Renderer).
  if (isTestMode()) {
    win.webContents.once("did-finish-load", () => {
      const m7ResultFile = process.env.FASTWORK_DESKTOP_M7_SMOKE_RESULT_FILE ?? process.env.FASTWORK_DESKTOP_M7_VERTICAL_RESULT_FILE;
      const isolationResultFile = process.env.FASTWORK_DESKTOP_M7_ISOLATION_RESULT_FILE;
      const vertical = process.env.FASTWORK_DESKTOP_M7_VERTICAL === "1";
      const m8Platform = process.env.FASTWORK_DESKTOP_M8_PLATFORM;
      const m8ResultFile = process.env.FASTWORK_DESKTOP_M8_SMOKE_RESULT_FILE;
      const m8MultiFile = process.env.FASTWORK_DESKTOP_M8_MULTI_RESULT_FILE;
      const m8VerticalFile = process.env.FASTWORK_DESKTOP_M8_VERTICAL_RESULT_FILE;
      if (m8VerticalFile && context) {
        void runM8VerticalProbe(context, m8VerticalFile).then(() => { app.exit(0); });
      } else if (m8MultiFile && context) {
        void runM8MultiPlatformProbe(context, m8MultiFile).then(() => { app.exit(0); });
      } else if (m8Platform && m8ResultFile && context) {
        void runM8PlatformProbe(context, m8Platform, m8ResultFile).then(() => { app.exit(0); });
      } else if (isolationResultFile && context) {
        void runPddSessionIsolationProbe(context, isolationResultFile).then(() => {
          app.exit(0);
        });
      } else if (m7ResultFile && context) {
        void runPddSmokeProbe(context, vertical ? "vertical" : "basic", m7ResultFile).then(() => {
          app.exit(0);
        });
      } else {
        void runSmokeProbe(win, process.env.FASTWORK_DESKTOP_SMOKE_RESULT_FILE).then(() => {
          app.exit(0);
        });
      }
    });
  }
  return win;
}

function wireBridges(win: BrowserWindow): void {
  const sink = {
    send: (channel: string, payload: unknown) => broadcast(win.webContents, channel, payload),
  };
  const ctx = context as NonNullable<typeof context>;
  const orchestratorBridge = new OrchestratorEventBridge(
    {
      on: (event: string, handler: (payload: unknown) => void) =>
        ctx.eventBus.on((ev, payload) => { if (ev === event) handler(payload); }),
    },
    sink,
    () => ctx.revision(),
  );
  orchestratorBridge.start();
  // M6: no live worker process; worker/shop bridges are wired to no-op sources
  // until M7/M8 (worker lifecycle + real shop store).
  const workerBridge = new WorkerStatusEventBridge({ onChange: () => () => {} }, sink);
  workerBridge.start();
  const shopBridge = new ShopEventBridge({ onChange: () => () => {} }, sink);
  shopBridge.start();
  bridges = [orchestratorBridge, workerBridge, shopBridge];
}

function contentBounds(): { x: number; y: number; width: number; height: number; visible: boolean } {
  if (!mainWindow || mainWindow.isDestroyed()) return { x: 0, y: 0, width: 1200, height: 800, visible: true };
  const b = mainWindow.getContentBounds();
  return { x: 0, y: 0, width: b.width, height: b.height, visible: true };
}

async function init(): Promise<void> {
  const vertical = process.env.FASTWORK_DESKTOP_M7_VERTICAL === "1";
  // PACK-003: production packaged-mode launcher. app.isPackaged is the real
  // Electron flag; FASTWORK_DESKTOP_PACKAGED=1 + FASTWORK_DESKTOP_PACKAGED_RESOURCES_PATH
  // let the packaged branch be exercised without producing an installer.
  const packaged = app.isPackaged === true || process.env.FASTWORK_DESKTOP_PACKAGED === "1";
  if (vertical) {
    const REBUILD = join(HERE, "..", "..", "..", "..");
    const WORKER_SRC = join(REBUILD, "services", "ai-worker", "src");
    workerClient = new AIWorkerClient({
      spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: REBUILD },
      env: { FASTWORK_DATA_DIR: process.env.FASTWORK_DATA_DIR ?? "", FASTWORK_M5_RAG_ROOT: process.env.FASTWORK_M5_RAG_ROOT ?? "", PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
      startupTimeoutMs: 20000,
      requestTimeoutMs: 60000,
    });
    await workerClient.start();
    const rebuild = (await workerClient.request("rag.rebuild_index", { mode: "full" })) as { ok?: boolean };
    if (rebuild?.ok !== true) throw new Error("rag.rebuild_index failed");
    // The rebuild response returns before the index is committed; wait for ready.
    const deadline = Date.now() + 30000;
    for (;;) {
      const status = (await workerClient.request("rag.index_status", {})) as { ready?: boolean };
      if (status?.ready === true) break;
      if (Date.now() >= deadline) throw new Error("rag index not ready");
      await new Promise((r) => setTimeout(r, 250));
    }
    // Compose the worker-backed Main context (shared with the PACK-003 packaged
    // production branch; DEV_ONLY / TEST_ONLY source-worker flow preserved).
    context = createWorkerBackedMainContext(
      { workerClient, dataRoot: process.env.FASTWORK_DATA_DIR ?? "" },
      { testMode: true },
    );
  } else if (packaged) {
    // Production packaged-mode Worker launch (PACK-003). Uses the packaged EXE at
    // <process.resourcesPath>\worker\fastwork-ai-worker.exe through the shared
    // @fastwork/worker-rpc abstraction. No py/python, no PYTHONPATH, no source
    // tree cwd. Missing packaged runtime artifacts fail loudly (no fallback).
    const resourcesPath = app.isPackaged ? process.resourcesPath : (process.env.FASTWORK_DESKTOP_PACKAGED_RESOURCES_PATH ?? "");
    if (!resourcesPath) {
      throw new Error("packaged mode requires a resources path (set FASTWORK_DESKTOP_PACKAGED_RESOURCES_PATH for simulation)");
    }
    const dataRoot = resolvePackagedDataRoot();
    workerClient = createPackagedWorkerClient(resourcesPath, dataRoot);
    await workerClient.start();
    context = createWorkerBackedMainContext({ workerClient, dataRoot });
  } else {
    context = createMainContext();
  }
  mainWindow = createWindow();
  const registered = registerIpc({
    orchestrator: context.orchestratorHost,
    shops: context.shops,
    worker: context.worker,
    projection: context.projection,
    coordinator: context.coordinator,
    platformForShop: context.platformForShop,
    contentBounds,
    revision: () => context!.revision(),
    trustedWebContents: () => mainWindow?.webContents ?? null,
    jobs: context.jobs,
    learning: context.learning,
    review: context.review,
    audit: context.audit,
    optimization: context.optimization,
    legacyImport: context.legacyImport,
    conversations: context.conversations,
    stores: context.stores,
    platformAccounts: context.platformAccounts,
    // SHEEP-063-PR2 (DP-94/98): the SINGLE Main-owned merchant authority source.
    // Production worker-backed composition always establishes it; null fails closed.
    workspaceMerchant: context.workspaceMerchant,
  });
  wireBridges(mainWindow);

  // Dedicated platform page IPC with its own trusted-webContents sender guard.
  const pageIpcStops: Array<() => void> = [];
  const registerPageIpcFor = (platform: string, register: (deps: { isTrustedWebContents(wc: unknown): boolean; onPageEvent(p: unknown): void; onCommandResult(p: unknown): void }) => () => void): void => {
    pageIpcStops.push(register({
      isTrustedWebContents: (wc) => context!.coordinator.isTrustedWebContents(platform as never, wc),
      onPageEvent: (payload) => context!.coordinator.handlePageEvent(platform as never, payload),
      onCommandResult: (payload) => context!.coordinator.handleCommandResult(platform as never, payload),
    }));
  };
  stopPddPageIpc = registerPddPageIpc({
    isTrustedPddWebContents: (wc) => context!.platform.isTrustedPddWebContents(wc),
    onPageEvent: (payload) => context!.platform.handlePageEvent(payload),
    onCommandResult: (payload) => context!.platform.handleCommandResult(payload),
  });
  registerPageIpcFor("doudian", (d) => registerDoudianPageIpc(d));
  registerPageIpcFor("jd", (d) => registerJDPageIpc(d));
  registerPageIpcFor("kuaishou", (d) => registerKuaishouPageIpc(d));
  registerPageIpcFor("qianniu", (d) => registerQianniuPageIpc(d));
  registerPageIpcFor("xianyu", (d) => registerXianyuPageIpc(d));

  // Broadcast PDD status changes to the renderer (typed event channel).
  context.platformStatusSink.current = (ev) => {
    broadcast(mainWindow?.webContents ?? null, IPC.platformStatusChanged, ev);
  };
  void PDD_PAGE_EVENT_CHANNEL;
  void PDD_PAGE_COMMAND_RESULT_CHANNEL;
  // CSP defense-in-depth via session header for local file loads (meta tag also present).
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [CSP] } });
  });
  console.log("M6 desktop ready; channels=" + registered.length);

  // PACK-005: env-gated packaged desktop smoke hook (test-support, Main only).
  // Observes the normal production bootstrap and exits via the normal quit path.
  if (isPackagedSmokeEnabled() && mainWindow) {
    void runPackagedSmokeProbe({ window: mainWindow, workerClient, context });
  }
}

app.whenReady().then(async () => {
  try {
    await init();
  } catch (e) {
    // PACK-005: in packaged smoke mode a startup abort (e.g. packaged Worker or
    // schemas missing) writes a machine-readable failure diagnostic and exits
    // non-zero instead of hanging. Normal (non-smoke) behavior is unchanged.
    if (isPackagedSmokeEnabled()) {
      writePackagedSmokeStartupFailure(e);
      app.exit(1);
      return;
    }
    throw e;
  }
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  if (!isTestMode()) app.quit();
});

app.on("before-quit", () => {
  stopPddPageIpc?.();
  stopPddPageIpc = null;
  context?.coordinator.disposeAll();
  context?.platform.disposeAll();
  for (const b of bridges) b.stop();
  bridges = [];
  if (workerClient) {
    void workerClient.stop().finally(() => { workerClient = null; });
  }
});

// Global hardening: no additional windows ever.
app.on("web-contents-created", (_event: Electron.Event, contents: WebContents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-attach-webview", denyWebview);
});

