// SHEEP-060 Queue visual evidence — Electron Main (evidence tooling only).
// Uses the REAL production architecture path:
//   temp evidence DB -> real ingestion boundary -> Sqlite repository ->
//   createWorkerBackedMainContext (production composition) -> real typed IPC ->
//   real sandboxed renderer. No renderer fake queue / dev fake source.
// FS_VISUAL_QUEUE_SEED=1 -> populated queue (active + keyboard-focused rows).
// FS_VISUAL_QUEUE_SEED != 1 -> production-real empty queue.
import { app, BrowserWindow } from "electron";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openDatabase,
  SqliteMerchantRepository,
  SqliteStoreRepository,
  SqlitePlatformAccountRepository,
  SqliteNormalizedConversationRepository,
} from "../../packages/persistence/dist/index.js";
import { createWorkerBackedMainContext } from "../../apps/desktop/dist/main/worker-runtime.js";
import { registerIpc } from "../../apps/desktop/dist/main/ipc/register-ipc.js";
import { createConversationIngestion } from "../../apps/desktop/dist/main/services/conversation-ingestion.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PRELOAD = join(ROOT, "apps", "desktop", "dist", "preload", "index.js");
const RENDERER_HTML = join(ROOT, "apps", "desktop", "dist", "renderer", "index.html");
const seed = process.env.FS_VISUAL_QUEUE_SEED === "1";
const OUT = seed
  ? join(ROOT, "reports", "visual-evidence", "sheep-060-queue-populated.png")
  : join(ROOT, "reports", "visual-evidence", "sheep-060-queue-empty.png");

const dataRoot = mkdtempSync(join(tmpdir(), "fs-queue-evidence-"));
let cleanupRoot = dataRoot;
const fakeWorkerClient = { request: async () => ({ ok: true, data: {} }) };

function seedEvidence(dbRoot) {
  const ctx = openDatabase(dbRoot);
  const merchants = new SqliteMerchantRepository(ctx.conn);
  const stores = new SqliteStoreRepository(ctx.conn);
  const accounts = new SqlitePlatformAccountRepository(ctx.conn);
  merchants.save({ id: "m-A", name: "merchant-A" });
  stores.save({ id: "shop-test-1", merchantId: "m-A", name: "测试店铺A", platform: "pdd" });
  stores.save({ id: "shop-test-2", merchantId: "m-A", name: "测试店铺B", platform: "pdd" });
  stores.save({ id: "shop-doudian-1", merchantId: "m-A", name: "抖店测试店铺", platform: "doudian" });
  for (const st of ["shop-test-1", "shop-test-2", "shop-doudian-1"]) {
    accounts.save({ id: "pa-" + st, merchantId: "m-A", platform: "pdd" });
  }
  const conversations = new SqliteNormalizedConversationRepository(ctx.conn);
  const ingestion = createConversationIngestion(conversations);
  ingestion.saveNormalizedConversation({ id: "conv-1001", merchantId: "m-A", storeId: "shop-test-1", platformAccountId: "pa-shop-test-1", externalRef: null });
  ingestion.saveNormalizedConversation({ id: "conv-1002", merchantId: "m-A", storeId: "shop-test-1", platformAccountId: "pa-shop-test-1", externalRef: null });
  ingestion.saveNormalizedConversation({ id: "conv-1003", merchantId: "m-A", storeId: "shop-test-2", platformAccountId: "pa-shop-test-2", externalRef: null });
}

app.setName("fast_sheep");
app.setPath("userData", join(app.getPath("appData"), "fast_sheep_queue_evidence"));

app.whenReady().then(async () => {
  let win = null;
  try {
    if (seed) seedEvidence(dataRoot);
    const context = createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot });
    win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.webContents.setBackgroundThrottling(false);
    win.webContents.on("console-message", (event) => {
      const msg = event && (event.message ?? event.args);
      console.log("RENDERER_CONSOLE[" + (event ? event.level : "?") + "] " + String(msg));
    });
    win.webContents.on("did-fail-load", (_e, code, desc) => { console.log("DID_FAIL_LOAD " + code + " " + desc); });
    registerIpc({
      orchestrator: context.orchestratorHost,
      shops: context.shops,
      worker: context.worker,
      projection: context.projection,
      coordinator: context.coordinator,
      platformForShop: context.platformForShop,
      revision: () => context.revision(),
      trustedWebContents: () => win.webContents,
      jobs: context.jobs,
      learning: context.learning,
      review: context.review,
      audit: context.audit,
      optimization: context.optimization,
      legacyImport: context.legacyImport,
      conversations: context.conversations,
      stores: context.stores,
      selectedShopId: () => context.projection.selectedShopId(),
    });
    await win.loadFile(RENDERER_HTML);
    const deadline = Date.now() + 20000;
    for (;;) {
      try {
        try {
          const rendered = await win.webContents.executeJavaScript("!!document.querySelector('.app-shell')", true);
          if (rendered) break;
        } catch (e) { console.log("WAIT_JS_ERR " + (e && e.message ? e.message : String(e))); }
        if (Date.now() >= deadline) break;
        await new Promise((r) => setTimeout(r, 200));
      } catch { /* booting */ }
      if (Date.now() >= deadline) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    if (seed) {
      // Wait for queue items, then demonstrate active vs keyboard-focused distinction:
      // activate row 1 via real pointer activation; focus row 2 via keyboard focus (no activation).
      const qDeadline = Date.now() + 15000;
      for (;;) {
        const ready = await win.webContents.executeJavaScript("document.querySelectorAll('.conversation-list-row').length >= 2", true).catch(() => false);
        if (ready) break;
        if (Date.now() >= qDeadline) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      await win.webContents.executeJavaScript("document.querySelector('.conversation-list-row').click(); true", true);
      await win.webContents.executeJavaScript("document.querySelectorAll('.conversation-list-row')[1].focus(); true", true);
      await new Promise((r) => setTimeout(r, 400));
    } else {
      await new Promise((r) => setTimeout(r, 400));
    }
    const image = await win.webContents.capturePage();
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, image.toPNG());
    console.log("CAPTURED " + OUT);
  } catch (e) {
    console.error("CAPTURE_ERROR " + (e && e.message ? e.message : String(e)));
    app.exit(1);
    return;
  }
  try { rmSync(cleanupRoot, { recursive: true, force: true }); } catch { }
  app.exit(0);
});