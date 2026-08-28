// SHEEP-063 Message Timeline visual evidence — Electron Main (evidence tooling only).
// Uses the REAL production architecture path:
//   temp evidence DB -> real workspace identity bootstrap + real ingestion boundary
//   -> Sqlite repositories -> createWorkerBackedMainContext (production composition)
//   -> real typed IPC -> real sandboxed renderer. No renderer fake timeline.
// FS_VISUAL_TIMELINE_STATE=populated  -> populated timeline (customer/agent + incomplete
//                                        historical + unknown-time message)
// FS_VISUAL_TIMELINE_STATE=empty      -> production-real empty timeline (no messages)
// FS_VISUAL_TIMELINE_STATE=switch     -> active conversation switch: populated -> empty,
//                                        proving no old facts residue (DP-89/I-7)
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
const STATE = process.env.FS_VISUAL_TIMELINE_STATE || "populated";
const OUT = join(ROOT, "reports", "visual-evidence",
  STATE === "empty" ? "sheep-063-timeline-empty.png"
  : STATE === "switch" ? "sheep-063-timeline-switch.png"
  : "sheep-063-timeline-populated.png");

const dataRoot = mkdtempSync(join(tmpdir(), "fs-timeline-evidence-"));
const fakeWorkerClient = { request: async () => ({ ok: true, data: {} }) };

function seedEvidence(dbRoot) {
  const ctx = openDatabase(dbRoot);
  // trusted workspace merchant FIRST (I-20/I-21)
  const wsId = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(ctx.conn));
  const merchants = new SqliteMerchantRepository(ctx.conn);
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
  // messages via the REAL ingestion boundary (DP-87 observed_at produced there)
  const messages = new SqliteMessageRepository(ctx.conn);
  const msgIng = createMessageIngestion(messages);
  msgIng.saveNormalizedMessage({ id: "msg-1", conversationId: "conv-populated", actor: "customer", contentKind: "text", contentText: "你好，这个商品有货吗？", occurredAt: "2026-08-28T09:00:00Z" });
  msgIng.saveNormalizedMessage({ id: "msg-2", conversationId: "conv-populated", actor: "agent", contentKind: "text", contentText: "亲，有的哦，今天下单明天就能发。", occurredAt: "2026-08-28T09:01:00Z" });
  msgIng.saveNormalizedMessage({ id: "msg-3", conversationId: "conv-populated", actor: "customer", contentKind: "text", contentText: "好的，那我拍两件。" });
  // incomplete historical fact: actor/content unknown (legacy fact-less row, I-16/DP-92)
  messages.save({ id: "msg-4", conversationId: "conv-populated", externalRef: "legacy-ext-4" });
  ctx.conn.close();
  return wsId;
}

app.setName("fast_sheep");
app.setPath("userData", join(app.getPath("appData"), "fast_sheep_timeline_evidence"));

app.whenReady().then(async () => {
  let win = null;
  try {
    const wsId = seedEvidence(dataRoot);
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
    const waitRows = async (min, selector) => {
      const d = Date.now() + 15000;
      for (;;) {
        const ready = await win.webContents.executeJavaScript("document.querySelectorAll('" + selector + "').length >= " + min, true).catch(() => false);
        if (ready) break;
        if (Date.now() >= d) break;
        await new Promise((r) => setTimeout(r, 200));
      }
    };
    const clickRow = async (index) => {
      await win.webContents.executeJavaScript("(function(){ var rows=document.querySelectorAll('.conversation-list-row'); if(!rows.length) return {ok:false,err:'no rows'}; rows[" + index + "].click(); return {ok:true}; })()", true);
    };
    if (STATE === "empty") {
      await waitRows(2, ".conversation-list-row");
      await clickRow(1); // conv-empty
      await waitRows(1, ".message-timeline .fs-state--empty");
    } else if (STATE === "switch") {
      await waitRows(2, ".conversation-list-row");
      await clickRow(0); // conv-populated
      await waitRows(4, ".timeline-message");
      await new Promise((r) => setTimeout(r, 300));
      await clickRow(1); // conv-empty -> active switch must clear old facts
      await waitRows(1, ".message-timeline .fs-state--empty");
    } else {
      await waitRows(2, ".conversation-list-row");
      await clickRow(0); // conv-populated
      await waitRows(4, ".timeline-message");
      await new Promise((r) => setTimeout(r, 300));
    }
    const image = await win.webContents.capturePage();
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, image.toPNG());
    console.log("CAPTURED " + OUT + " (wsId=" + wsId + ")");
  } catch (e) {
    console.error("CAPTURE_ERROR " + (e && e.message ? e.message : String(e)));
    app.exit(1);
    return;
  }
  try { rmSync(dataRoot, { recursive: true, force: true }); } catch { }
  app.exit(0);
});
