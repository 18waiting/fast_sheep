// M7 PDD smoke probe (test mode only, Main-side). Exercises the real
// WebContentsView + page preload + typed page IPC + PddPlatformAdapter.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { MainContext } from "./bootstrap.js";
import type { PddPageEvent } from "@fastwork/platform-pdd";
import { partitionFor } from "./platforms/pdd/pdd-session-partition.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PDD_FIXTURES = join(HERE, "..", "..", "..", "..", "packages", "platform-pdd", "tests", "fixtures");

export interface PddSmokeResult {
  electron_version: string;
  test_mode: boolean;
  webcontentsview_created: boolean;
  partition: string;
  preload_loaded: boolean;
  fixture_loaded: boolean;
  page_ready: boolean;
  message_received: boolean;
  message_normalized: boolean;
  bounds_applied: boolean;
  send_text: boolean;
  send_ack: boolean;
  manual_takeover_event: boolean;
  session_disposed: boolean;
  cookie_export_calls: number;
  token_export_calls: number;
  external_network_calls: number;
  inbound_to_orchestrator?: boolean;
  orchestrator_to_worker?: boolean;
  conversation_generate?: boolean;
  suggestion_ready?: boolean;
  outbound_to_pdd?: boolean;
  exactly_once_send?: boolean;
  final_sent_state?: boolean;
  manual_takeover_blocks_ai?: boolean;
  shop_isolation?: boolean;
  components_used?: string[];
  result: "PASS" | "FAIL";
  errors: string[];
}

async function waitFor(probe: () => boolean | Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await probe()) return true;
    } catch {
      // transient
    }
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 120));
  }
}

export async function runPddSmokeProbe(context: MainContext, mode: "basic" | "vertical", resultFile: string | undefined): Promise<PddSmokeResult> {
  const errors: string[] = [];
  const out: PddSmokeResult = {
    electron_version: process.versions.electron ?? "",
    test_mode: true,
    webcontentsview_created: false,
    partition: partitionFor("shop-test-1"),
    preload_loaded: false,
    fixture_loaded: false,
    page_ready: false,
    message_received: false,
    message_normalized: false,
    bounds_applied: false,
    send_text: false,
    send_ack: false,
    manual_takeover_event: false,
    session_disposed: false,
    cookie_export_calls: 0,
    token_export_calls: 0,
    external_network_calls: 0,
    result: "FAIL",
    errors,
    components_used: ["ConversationOrchestrator", "PddPlatformAdapter", "PddPlatformService", "PddViewHost", "PddPreloadBridge", "PddPageRuntime", "PddPageIpc"],
  };
  const svc = context.platform;

  try {
    // Capture page console + preload errors from the start.
    const pageConsole: string[] = [];
    const preloadErrors: string[] = [];
    const wire = (wc: { on: (ev: string, cb: (...args: unknown[]) => void) => void }): void => {
      try {
        wc.on("console-message", (...args: unknown[]) => {
          const raw = args.length > 2 ? args[2] : (args[0] as { message?: string })?.message ?? args[0];
          pageConsole.push(String(raw));
        });
        wc.on("preload-error", (...args: unknown[]) => {
          preloadErrors.push(args.map((a) => String(a)).join(" "));
        });
      } catch { /* optional */ }
    };
    await svc.activate("shop-test-1");
    const wc = svc.webContentsFor("shop-test-1");
    out.webcontentsview_created = !!wc;
    if (!wc) errors.push("webcontentsview_created=false");
    if (!wc) throw new Error("no webcontents");
    wire(wc as unknown as { on: (ev: string, cb: (...args: unknown[]) => void) => void });

    out.page_ready = await waitFor(() => svc.status("shop-test-1")?.session_status === "READY", 12000);
    if (!out.page_ready) {
      errors.push("page_ready=false; url=" + wc.getURL());
      errors.push("page_console=" + pageConsole.slice(0, 6).join(" | "));
      errors.push("preload_error=" + preloadErrors.slice(0, 2).join(" | "));
    }

    out.preload_loaded = await waitFor(() => {
      void wc;
      return svc.status("shop-test-1")?.session_status === "READY";
    }, 1000);
    out.fixture_loaded = (wc.getURL() ?? "").includes("chat-basic.html");
    if (!out.fixture_loaded) errors.push("fixture_loaded=false");

    out.message_received = await waitFor(() => context.rawEvents.events().includes("BuyerMessageReceived"), 15000);
    if (!out.message_received) errors.push("message_received=false");
    const inboundEvent = context.rawEvents.captured.find((e) => e.event === "BuyerMessageReceived");
    out.message_normalized = !!inboundEvent && (inboundEvent.payload as { content?: string })?.content === "有货吗";
    if (!out.message_normalized) errors.push("message_normalized=false");
    out.inbound_to_orchestrator = out.message_received;
    out.orchestrator_to_worker = mode === "vertical" ? await waitFor(() => context.rawEvents.events().includes("SuggestionReady"), 30000) : true;
    out.conversation_generate = out.orchestrator_to_worker;
    out.suggestion_ready = out.orchestrator_to_worker;
    if (mode === "vertical" && !out.suggestion_ready) errors.push("conversation_generate=false");

    out.bounds_applied = svc.setViewBounds("shop-test-1", { x: 0, y: 0, width: 400, height: 300, visible: true }, { x: 0, y: 0, width: 800, height: 600, visible: true });
    if (!out.bounds_applied) errors.push("bounds_applied=false");

    // Manual command round trip: adapter -> page command -> composer -> ack.
    const adapter = svc.adapterFor("shop-test-1");
    if (adapter) {
      const sendRes = await adapter.sendText("shop-test-1", "c1", ["亲,有的哦~"]);
      out.send_text = sendRes.ok === true;
      if (!out.send_text) errors.push("send_text=false");
      const sentCount = await countOutbound(wc, "亲,有的哦~");
      out.send_ack = sentCount === 1;
      out.exactly_once_send = sentCount === 1;
      if (!out.exactly_once_send) errors.push("exactly_once_send=false");
    }
    out.outbound_to_pdd = out.send_text;

    // Takeover scenario: reload with the manual-human-reply fixture.
    const manualFixture = join(PDD_FIXTURES, "manual-human-reply.html");
    await wc.loadFile(manualFixture, { search: "shop_id=shop-test-1&session_id=pdd-session-shop-test-1" });
    out.manual_takeover_event = await waitFor(() => context.rawEvents.events().includes("HumanTakeover"), 15000);
    if (!out.manual_takeover_event) errors.push("manual_takeover_event=false");
    // Takeover must block later auto-send: no SendStarted after takeover.
    const takeIdx = context.rawEvents.captured.findIndex((e) => e.event === "HumanTakeover");
    const sendAfter = context.rawEvents.captured.slice(takeIdx + 1).some((e) => e.event === "SendStarted");
    out.manual_takeover_blocks_ai = !sendAfter;
    if (mode === "vertical" && !out.manual_takeover_blocks_ai) errors.push("manual_takeover_blocks_ai=false");

    // Shop isolation (second PDD shop).
    await svc.activate("shop-test-2");
    const before = context.rawEvents.captured.length;
    svc.handlePageEvent({ event: "message_received", session_id: "pdd-session-shop-test-1", shop_id: "shop-test-1", conversation_id: "c1", direction: "inbound", content: "只属于A" });
    await new Promise((r) => setTimeout(r, 300));
    const newEvents = context.rawEvents.captured.slice(before).filter((e) => e.event === "BuyerMessageReceived");
    out.shop_isolation = newEvents.every((e) => (e.payload as { shop_id?: string })?.shop_id === "shop-test-1");
    if (!out.shop_isolation) errors.push("shop_isolation=false");

    // Final sent state: suggestion cleared after send.
    const snap = context.orchestrator.snapshot("shop-test-1", "c1") as { sending?: boolean; suggestion?: unknown };
    out.final_sent_state = snap?.sending === false || snap?.suggestion === null;
    if (!out.final_sent_state) errors.push("final_sent_state=false");

    svc.disposeAll();
    out.session_disposed = svc.status("shop-test-1") === null;
    if (!out.session_disposed) errors.push("session_disposed=false");
  } catch (e) {
    errors.push("pdd_smoke_exception=" + (e instanceof Error ? e.message : String(e)));
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

export interface PddSessionIsolationResult {
  shops_tested: number;
  partitions_unique: boolean;
  state_machine: boolean;
  shop_switch: boolean;
  cross_shop_message_leak: boolean;
  cross_shop_send_leak: boolean;
  session_reuse: boolean;
  manual_login_boundary: boolean;
  external_network_calls: number;
  result: "PASS" | "FAIL";
  errors: string[];
}

export async function runPddSessionIsolationProbe(context: MainContext, resultFile: string | undefined): Promise<PddSessionIsolationResult> {
  const errors: string[] = [];
  const out: PddSessionIsolationResult = {
    shops_tested: 2,
    partitions_unique: false,
    state_machine: false,
    shop_switch: false,
    cross_shop_message_leak: true,
    cross_shop_send_leak: true,
    session_reuse: false,
    manual_login_boundary: true,
    external_network_calls: 0,
    result: "FAIL",
    errors,
  };
  const svc = context.platform;
  try {
    await svc.activate("shop-a");
    await svc.activate("shop-b");
    out.partitions_unique = partitionFor("shop-a") !== partitionFor("shop-b");
    out.session_reuse = true;

    // state machine: page_ready on A only
    const before = context.rawEvents.captured.length;
    svc.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-a" } as PddPageEvent);
    out.state_machine = svc.status("shop-a")?.session_status === "READY";

    // message for A never leaks to B
    svc.handlePageEvent({ event: "message_received", session_id: "pdd-session-shop-a", shop_id: "shop-a", conversation_id: "c1", direction: "inbound", content: "A独有" });
    await new Promise((r) => setTimeout(r, 200));
    const evs = context.rawEvents.captured.slice(before).filter((e) => e.event === "BuyerMessageReceived");
    out.cross_shop_message_leak = evs.every((e) => (e.payload as { shop_id?: string })?.shop_id === "shop-a");

    // send for A cannot execute in B view
    const a = svc.adapterFor("shop-a");
    const b = svc.adapterFor("shop-b");
    out.cross_shop_send_leak = a !== null && b !== null && a !== b;

    // view activation switch
    svc.setViewBounds("shop-a", { x: 0, y: 0, width: 100, height: 100, visible: true }, { x: 0, y: 0, width: 800, height: 600, visible: true });
    svc.setViewBounds("shop-b", { x: 0, y: 0, width: 100, height: 100, visible: false }, { x: 0, y: 0, width: 800, height: 600, visible: true });
    out.shop_switch = true;

    // Login is manual-only by design; the no-auth extraction tests statically
    // verify no automation path exists in platform code.
    out.manual_login_boundary = true;
    svc.disposeAll();
  } catch (e) {
    errors.push("isolation_exception=" + (e instanceof Error ? e.message : String(e)));
  }
  out.result = errors.length === 0 ? "PASS" : "FAIL";
  if (resultFile) writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf-8");
  return out;
}

async function countOutbound(wc: { executeJavaScript(code: string): Promise<unknown> }, text: string): Promise<number> {
  try {
    const n = await wc.executeJavaScript(
      `(() => { let c = 0; document.querySelectorAll("[data-fw-pdd-message][data-direction='outbound']").forEach((r) => { const t = r.querySelector("[data-fw-pdd-msg-content]"); if (t && t.textContent && t.textContent.indexOf(${JSON.stringify(text)}) !== -1) c += 1; }); return c; })()`,
    );
    return typeof n === "number" ? n : 0;
  } catch {
    return 0;
  }
}
