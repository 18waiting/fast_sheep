// SHEEP-044 visual evidence capture — Electron Main (evidence tooling only).
// Boots the REAL sandboxed preload + renderer with a minimal Main-side IPC stub
// (synthetic test data) so the Fast Sheep workbench renders, then captures a PNG
// for HUMAN design review. NOT part of production runtime; no FastWork pixel-match.
const { app, BrowserWindow, ipcMain } = require("electron");
const { join, dirname } = require("node:path");
const { writeFileSync, mkdirSync } = require("node:fs");

const ROOT = join(__dirname, "..", "..");
const PRELOAD = join(ROOT, "apps", "desktop", "dist", "preload", "index.js");
const RENDERER_HTML = join(ROOT, "apps", "desktop", "dist", "renderer", "index.html");
const TARGET = process.env.FS_VISUAL_TARGET || "workbench";
const OUT = TARGET === "gallery"
  ? join(ROOT, "reports", "visual-evidence", "sheep-045-primitive-gallery.png")
  : TARGET === "states"
  ? join(ROOT, "reports", "visual-evidence", "sheep-046-state-gallery.png")
  : TARGET === "focus"
  ? join(ROOT, "reports", "visual-evidence", "sheep-047-a11y-focus-gallery.png")
  : join(ROOT, "reports", "visual-evidence", "sheep-047-workbench.png");
const GALLERY_HTML = join(ROOT, "reports", "visual-evidence", "primitive-gallery.html");
const STATES_HTML = join(ROOT, "reports", "visual-evidence", "state-gallery.html");
const FOCUS_HTML = join(ROOT, "reports", "visual-evidence", "a11y-focus-gallery.html");

const shops = [
  { shop_id: "shop-test-1", name: "测试店铺A", type: "pdd", enabled: true },
  { shop_id: "shop-test-2", name: "测试店铺B", type: "pdd", enabled: true },
  { shop_id: "shop-doudian-1", name: "抖店测试店铺", type: "doudian", enabled: true },
];
const viewModel = {
  revision: 1,
  shop_summaries: shops,
  selected_shop_id: "shop-test-1",
  conversation: { conversation_id: "c1", shop_id: "shop-test-1", state: "idle", buyer: "买家-张三" },
  suggestion: { reply: "建议回复：您好，这款商品48小时内发货，感谢您的耐心等待。", generation: 3, status: "pending" },
  mode: "human_review",
  countdown: null,
  worker_status: { status: "ready" },
  platform_capability: "none",
};
const ok = (data) => ({ ok: true, data });
const okTrue = () => ok({ ok: true });
function handle(channel, fn) { ipcMain.handle(channel, fn); }

handle("desktop.bootstrap", () => ok({ revision: 1, worker_status: { status: "ready" }, shops, view_model: viewModel }));
handle("shops.list", () => ok({ shops }));
handle("orchestrator.snapshot", () => ok(viewModel));
handle("worker.status", () => ok({ status: "ready" }));
handle("orchestrator.set_mode", okTrue);
handle("orchestrator.manual_send", okTrue);
handle("orchestrator.no_save_send", okTrue);
handle("orchestrator.cancel", okTrue);
handle("orchestrator.focus", okTrue);
handle("platform.status", () => ok({ shop_id: "shop-test-1", platform: "pdd", session_status: "READY", view_visible: true }));
handle("platform.activate_shop", okTrue);
handle("platform.set_view_bounds", okTrue);
handle("platform.reload", okTrue);
handle("jobs.list", () => ok({ jobs: [] }));
handle("jobs.get", () => ok({ job_id: "", state: "COMPLETED" }));
handle("jobs.cancel", okTrue);
handle("learning.start", () => ok({ job_id: "j1", ok: true }));
handle("review.propose", okTrue);
handle("review.apply", okTrue);
handle("review.restore", okTrue);
handle("audit.decide", okTrue);
handle("optimization.propose", okTrue);
handle("optimization.apply", okTrue);
handle("legacy_import.select", () => ok({ source_id: "", status: "idle" }));
handle("legacy_import.scan", () => ok({ item_count: 0 }));
handle("legacy_import.plan", () => ok({ plan_sha256: "" }));
handle("legacy_import.dry_run", () => ok({ plan: {} }));
handle("legacy_import.apply", () => ok({ session_id: "", state: "idle" }));
handle("legacy_import.status", () => ok({ session_id: "", state: "idle" }));
handle("legacy_import.cancel", okTrue);

app.setName("fast_sheep");
app.setPath("userData", join(app.getPath("appData"), "fast_sheep_visual_evidence"));

app.whenReady().then(async () => {
  const isStatic = TARGET === "gallery" || TARGET === "states" || TARGET === "focus";
  const html = TARGET === "gallery" ? GALLERY_HTML : TARGET === "states" ? STATES_HTML : TARGET === "focus" ? FOCUS_HTML : RENDERER_HTML;
  const win = new BrowserWindow({
    width: isStatic ? (TARGET === "states" ? 760 : 1000) : 1200,
    height: isStatic ? (TARGET === "states" ? 1080 : 720) : 800,
    show: false,
    webPreferences: isStatic
      ? { contextIsolation: true, nodeIntegration: false, sandbox: true }
      : { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setBackgroundThrottling(false);
  await win.loadFile(html);
  const deadline = Date.now() + 20000;
  for (;;) {
    try {
      const rendered = await win.webContents.executeJavaScript(
        isStatic ? "!!document.querySelector('.g-section')" : "!!document.querySelector('.app-shell')",
        true
      );
      if (rendered) break;
    } catch { /* booting */ }
    if (Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  await new Promise((r) => setTimeout(r, 1200));
  const image = await win.webContents.capturePage();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, image.toPNG());
  console.log("CAPTURED " + OUT);
  app.exit(0);
});