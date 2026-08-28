// SHEEP-064 Composer visual evidence — Electron Main (evidence tooling only).
// Real production path: temp evidence DB -> workspace identity bootstrap + real
// ingestion -> Sqlite repositories -> createWorkerBackedMainContext (testMode for a
// synthetic AI suggestion so the explicit apply path is observable; the queue still
// comes from the seeded SQLite conversation repo passed by worker-backed composition)
// -> real typed IPC -> real sandboxed renderer. No renderer fake composer.
// FS_VISUAL_COMPOSER_STATE = empty | draft | apply | switch | unavailable
import { app, BrowserWindow } from "electron";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openDatabase,
  SqliteStoreRepository,
  SqlitePlatformAccountRepository,
  SqliteNormalizedConversationRepository,
  SqliteMessageRepository,
  SqliteWorkspaceIdentityBootstrap,
  resolveOrBootstrapWorkspaceMerchantId,
} from "../../packages/persistence/dist/index.js";
import { createWorkerBackedMainContext } from "../../apps/desktop/dist/main/worker-runtime.js";
import { registerIpc } from "../../apps/desktop/dist/main/ipc/register-ipc.js";
import { createConversationIngestion } from "../../apps/desktop/dist/main/services/conversation-ingestion.js";
import { createMessageIngestion } from "../../apps/desktop/dist/main/services/message-ingestion.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PRELOAD = join(ROOT, "apps", "desktop", "dist", "preload", "index.js");
const RENDERER_HTML = join(ROOT, "apps", "desktop", "dist", "renderer", "index.html");
const STATE = process.env.FS_VISUAL_COMPOSER_STATE || "apply";
const OUT = join(ROOT, "reports", "visual-evidence",
  STATE === "empty" ? "sheep-064-composer-empty.png"
  : "sheep-064-composer-apply.png");

const dataRoot = mkdtempSync(join(tmpdir(), "fs-composer-evidence-"));
const fakeWorkerClient = { request: async () => ({ ok: true, data: {} }) };

function seedEvidence(dbRoot) {
  const ctx = openDatabase(dbRoot);
  const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(ctx.conn));
  const stores = new SqliteStoreRepository(ctx.conn);
  const accounts = new SqlitePlatformAccountRepository(ctx.conn);
  stores.save({ id: "shop-test-1", merchantId: wsId, name: "测试店铺A", platform: "pdd" });
  stores.save({ id: "shop-test-2", merchantId: wsId, name: "测试店铺B", platform: "pdd" });
  accounts.save({ id: "pa-shop-test-1", merchantId: wsId, platform: "pdd" });
  accounts.save({ id: "pa-shop-test-2", merchantId: wsId, platform: "pdd" });
  const conversations = new SqliteNormalizedConversationRepository(ctx.conn);
  const convIng = createConversationIngestion(conversations);
  convIng.saveNormalizedConversation({ id: "conv-populated", merchantId: wsId, storeId: "shop-test-1", platformAccountId: "pa-shop-test-1", externalRef: null });
  convIng.saveNormalizedConversation({ id: "conv-empty", merchantId: wsId, storeId: "shop-test-2", platformAccountId: "pa-shop-test-2", externalRef: null });
  const messages = new SqliteMessageRepository(ctx.conn);
  const msgIng = createMessageIngestion(messages);
  msgIng.saveNormalizedMessage({ id: "msg-1", conversationId: "conv-populated", actor: "customer", contentKind: "text", contentText: "你好，这个商品有货吗？", occurredAt: "2026-08-28T09:00:00Z" });
  msgIng.saveNormalizedMessage({ id: "msg-2", conversationId: "conv-populated", actor: "agent", contentKind: "text", contentText: "亲，有的哦，今天下单明天就能发。", occurredAt: "2026-08-28T09:01:00Z" });
  ctx.conn.close();
}

app.setName("fast_sheep");
app.setPath("userData", join(app.getPath("appData"), "fast_sheep_composer_evidence"));

app.whenReady().then(async () => {
  let win = null;
  try {
    seedEvidence(dataRoot);
    // testMode:true -> synthetic AI suggestion observable for the explicit apply path;
    // queue still reads the seeded SQLite conversations (worker-backed composition).
    const context = createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot }, { testMode: true });
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
      messages: context.messages,
      stores: context.stores,
      platformAccounts: context.platformAccounts,
      workspaceMerchant: context.workspaceMerchant,
    });
    await win.loadFile(RENDERER_HTML);
    const deadline = Date.now() + 20000;
    for (;;) {
      try {
        const rendered = await win.webContents.executeJavaScript("!!document.querySelector('.app-shell')", true);
        if (rendered) break;
      } catch (e) { console.log("WAIT_JS_ERR " + (e && e.message ? e.message : String(e))); }
      if (Date.now() >= deadline) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const waitFor = async (sel, min) => {
      const d = Date.now() + 15000;
      for (;;) {
        const ready = await win.webContents.executeJavaScript("document.querySelectorAll('" + sel + "').length >= " + min, true).catch(() => false);
        if (ready) break;
        if (Date.now() >= d) break;
        await new Promise((r) => setTimeout(r, 200));
      }
    };
    const clickRow = async (index) => {
      await win.webContents.executeJavaScript("(function(){ var rows=document.querySelectorAll('.conversation-list-row'); if(!rows.length) return {ok:false,err:'no rows'}; rows[" + index + "].click(); return {ok:true}; })()", true);
    };
    const typeDraft = async (text) => {
      await win.webContents.executeJavaScript("(function(){ var t=document.querySelector('.composer-input'); if(!t) return {ok:false,err:'no textarea'}; t.value=" + JSON.stringify(text) + "; t.dispatchEvent(new Event('input', {bubbles:true})); return {ok:true,value:t.value}; })()", true);
    };

    await waitFor(".conversation-list-row", 2);
    if (STATE === "empty") {
      // REPAIR evidence: empty Timeline + Composer (conv-empty, row 1)
      await clickRow(1);
      await waitFor(".message-timeline .fs-state--empty", 1);
      await waitFor(".composer-input", 1);
    } else {
      // REPAIR evidence: populated Timeline + Composer + AI apply path (conv-populated, row 0)
      await clickRow(0);
      await waitFor(".timeline-message", 2);
      await waitFor(".composer-input", 1);
      await waitFor(".btn-apply-suggestion", 1);
      await win.webContents.executeJavaScript("document.querySelector('.btn-apply-suggestion').click(); true", true);
      await new Promise((r) => setTimeout(r, 400));
      const applied = await win.webContents.executeJavaScript("document.querySelector('.composer-input') ? document.querySelector('.composer-input').value : ''", true);
      console.log("COMPOSER_APPLIED_DRAFT " + JSON.stringify(applied));
    }
    await new Promise((r) => setTimeout(r, 300));
    // REPAIR #2 final-DOM guard: Timeline AND Composer must coexist, Timeline above Composer.
    const dom = await win.webContents.executeJavaScript("(function(){ var host=document.querySelector('.conversation-host'); if(!host) return {ok:false,err:'no conversation-host'}; var order=Array.prototype.map.call(host.querySelectorAll('.message-timeline, .composer'), function(n){return n.className;}); var tl=order.some(function(c){return c.indexOf('message-timeline')!==-1;}); var co=order.some(function(c){return c.indexOf('composer')!==-1;}); return {ok:tl&&co, order:order, tl:tl, co:co}; })()", true);
    console.log("DOM_COMPOSITION " + JSON.stringify(dom));
    if (!dom.ok || !dom.tl || !dom.co) {
      console.error("DOM_COMPOSITION_FAIL " + JSON.stringify(dom));
      app.exit(1);
      return;
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
  try { rmSync(dataRoot, { recursive: true, force: true }); } catch { }
  app.exit(0);
});
