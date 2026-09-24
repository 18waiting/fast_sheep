// Test-mode-only, local-fixture Renderer/Main fallback path probe.
// DOM click is synthetic; this does not prove human focus or real login.
import type { BrowserWindow } from "electron";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MainContext } from "./bootstrap.js";

interface FallbackInteractionResult {
  renderer_booted: boolean;
  window_shown: boolean;
  pdd_a_surface: boolean;
  pdd_b_switch: boolean;
  non_pdd_close: boolean;
  untagged_event_rejected: boolean;
  stale_document_event_rejected: boolean;
  login_required_projection: boolean;
  fixture_urls_local: boolean;
  queue_all_stores_empty_after_switches: boolean;
  login_required_diagnostic?: { main_status: string | null; dom_status: string | null; dom_label: string | null };
  screenshot_file: string | null;
  result: "PASS" | "FAIL";
  errors: string[];
}

async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 15000): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { if (await check()) return true; } catch { /* renderer may be re-rendering */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

export async function runSyntheticFallbackInteractionProbe(context: MainContext, win: BrowserWindow, resultFile: string): Promise<FallbackInteractionResult> {
  const out: FallbackInteractionResult = {
    renderer_booted: false, window_shown: false, pdd_a_surface: false,
    pdd_b_switch: false, non_pdd_close: false, untagged_event_rejected: false,
    stale_document_event_rejected: false, login_required_projection: false,
    fixture_urls_local: false, queue_all_stores_empty_after_switches: false,
    screenshot_file: null, result: "FAIL", errors: [],
  };
  const js = <T>(code: string): Promise<T> => win.webContents.executeJavaScript(code, true) as Promise<T>;
  const clickShop = async (label: string): Promise<boolean> => js<boolean>(
    `(() => { const b = [...document.querySelectorAll('.shop-button')].find((e) => e.textContent === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`,
  );
  const selected = (label: string): Promise<boolean> => js<boolean>(
    `document.querySelector('.shop-button.selected')?.textContent === ${JSON.stringify(label)}`,
  );
  try {
    win.showInactive();
    out.window_shown = win.isVisible();
    out.renderer_booted = await waitFor(() => js<boolean>("document.body?.dataset.booted === 'true'"));
    if (!out.renderer_booted) throw new Error("renderer_not_booted");
    if (!await clickShop("测试店铺A")) throw new Error("pdd_a_button_missing");
    out.pdd_a_surface = await waitFor(async () => (await selected("测试店铺A"))
      && (await js<boolean>("!!document.querySelector('.platform-surface[data-platform=\"pdd\"]')"))
      && context.coordinator.status("pdd", "shop-test-1")?.view_visible === true);
    if (!out.pdd_a_surface) out.errors.push("pdd_a_surface=false");
    const loginProjected = async (): Promise<boolean> =>
      (await selected("测试店铺A"))
      && context.coordinator.status("pdd", "shop-test-1")?.session_status === "LOGIN_REQUIRED"
      && (await js<boolean>("document.querySelector('.platform-surface[data-session-status=\"LOGIN_REQUIRED\"] .platform-overlay-label')?.textContent === '需要登录 (手动登录)'"));
    if (!await waitFor(loginProjected)) out.errors.push("initial_login_required_projection=false");

    if (!await clickShop("测试店铺B")) throw new Error("pdd_b_button_missing");
    out.pdd_b_switch = await waitFor(async () => (await selected("测试店铺B"))
      && context.coordinator.status("pdd", "shop-test-1")?.view_visible === false
      && context.coordinator.status("pdd", "shop-test-2")?.view_visible === true);
    if (!out.pdd_b_switch) out.errors.push("pdd_b_switch=false");

    if (!await clickShop("抖店测试店铺")) throw new Error("non_pdd_button_missing");
    out.non_pdd_close = await waitFor(async () => (await selected("抖店测试店铺"))
      && (await js<boolean>("!!document.querySelector('.empty-platform-panel')"))
      && context.coordinator.status("pdd", "shop-test-2")?.view_visible === false);
    if (!out.non_pdd_close) out.errors.push("non_pdd_close=false");

    if (!await clickShop("测试店铺A")) throw new Error("pdd_a_return_button_missing");
    if (!await waitFor(async () => (await selected("测试店铺A"))
      && context.coordinator.status("pdd", "shop-test-1")?.view_visible === true)) {
      throw new Error("pdd_a_return_not_visible");
    }
    // Resolve the Main-issued generation from the loaded local fixture, not a
    // guessed counter; sender ownership and document freshness must both hold.
    const sender = context.platform.webContentsFor("shop-test-1");
    if (!sender) throw new Error("pdd_a_sender_missing");
    const fixtureUrl = new URL(sender.getURL());
    if (fixtureUrl.protocol !== "file:" || !fixtureUrl.pathname.endsWith("/login-required.html")
      || fixtureUrl.searchParams.get("shop_id") !== "shop-test-1"
      || fixtureUrl.searchParams.get("session_id") !== "pdd-session-shop-test-1") {
      throw new Error("pdd_a_fixture_binding_invalid");
    }
    const generationText = fixtureUrl.searchParams.get("document_generation");
    if (!generationText || !/^[1-9]\d*$/.test(generationText)) throw new Error("fixture_generation_missing");
    const documentGeneration = Number(generationText);
    if (!Number.isSafeInteger(documentGeneration)) throw new Error("fixture_generation_invalid");
    // The real fixture preload emits login_required during LOADING. A stale or
    // untagged page_ready must not clear that login gate after navigation.
    const readyEvent = { event: "page_ready" as const, shop_id: "shop-test-1", session_id: "pdd-session-shop-test-1" };
    context.platform.handlePageEvent(readyEvent, sender);
    out.untagged_event_rejected = context.coordinator.status("pdd", "shop-test-1")?.session_status === "LOGIN_REQUIRED";
    if (!out.untagged_event_rejected) out.errors.push("untagged_event_rejected=false");
    context.platform.handlePageEvent({ ...readyEvent, document_generation: documentGeneration - 1 }, sender);
    out.stale_document_event_rejected = context.coordinator.status("pdd", "shop-test-1")?.session_status === "LOGIN_REQUIRED";
    if (!out.stale_document_event_rejected) out.errors.push("stale_document_event_rejected=false");
    out.login_required_projection = await waitFor(loginProjected);
    if (!out.login_required_projection) {
      out.login_required_diagnostic = {
        main_status: context.coordinator.status("pdd", "shop-test-1")?.session_status ?? null,
        dom_status: await js<string | null>("document.querySelector('.platform-surface')?.getAttribute('data-session-status') ?? null"),
        dom_label: await js<string | null>("document.querySelector('.platform-overlay-label')?.textContent ?? null"),
      };
      out.errors.push("login_required_projection=false");
    }

    out.fixture_urls_local = ["shop-test-1", "shop-test-2"].every((id) =>
      context.platform.webContentsFor(id)?.getURL().startsWith("file://"));
    if (!out.fixture_urls_local) out.errors.push("fixture_urls_local=false");
    // This test-mode merchant has no canonical Stores. Switching runtime Shops
    // must not turn a Shop id into a specific_store query. This checks only the
    // empty Queue projection, not real conversation data or human usability.
    out.queue_all_stores_empty_after_switches = await waitFor(() => js<boolean>(`(() => {
      const queue = document.querySelector('.conversation-list');
      return !!queue
        && queue.querySelector('.conversation-list-scope-store')?.value === '__all_stores__'
        && !!queue.querySelector('.fs-state--empty')
        && queue.textContent?.includes('暂无会话') === true
        && !queue.querySelector('.fs-state--error');
    })()`));
    if (!out.queue_all_stores_empty_after_switches) out.errors.push("queue_all_stores_empty_after_switches=false");
    if (out.window_shown) {
      // Allow the final Renderer commit to settle before recording visual context.
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (!await loginProjected()) out.errors.push("final_login_required_projection=false");
      const screenshot = join(dirname(resultFile), "login-required-window.png");
      writeFileSync(screenshot, (await win.capturePage()).toPNG());
      out.screenshot_file = screenshot;
    } else out.errors.push("window_shown=false");
  } catch (error) {
    out.errors.push("fallback_probe_exception=" + (error instanceof Error ? error.message : String(error)));
  }
  out.result = out.errors.length === 0 ? "PASS" : "FAIL";
  writeFileSync(resultFile, JSON.stringify(out, null, 2) + "\n");
  return out;
}
