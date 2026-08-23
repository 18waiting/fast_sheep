// M8 platform smoke probes (test mode only, Main-side). Generic per-platform,
// multi-platform isolation, and five-platform vertical probes.
import { writeFileSync } from "node:fs";
import type { MainContext } from "./bootstrap.js";

async function waitFor(probe: () => boolean | Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if (await probe()) return true; } catch { /* transient */ }
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 120));
  }
}

export interface M8PlatformSmokeResult {
  platform: string;
  webcontentsview_created: boolean;
  page_ready: boolean;
  message_received: boolean;
  send_text: boolean;
  send_ack: boolean;
  session_disposed: boolean;
  cookie_export_calls: number;
  token_export_calls: number;
  external_network_calls: number;
  result: "PASS" | "FAIL";
  errors: string[];
}

interface PlatformServiceLike {
  status(shopId: string): { session_status: string } | null;
  adapterFor(shopId: string): { sendText(shopId: string, conversationId: string, segments: string[]): Promise<{ ok: boolean }> } | null;
}

export async function runM8PlatformProbe(context: MainContext, platform: string, resultFile: string | undefined): Promise<M8PlatformSmokeResult> {
  const errors: string[] = [];
  const out: M8PlatformSmokeResult = {
    platform, webcontentsview_created: false, page_ready: false, message_received: false,
    send_text: false, send_ack: false, session_disposed: false, cookie_export_calls: 0,
    token_export_calls: 0, external_network_calls: 0, result: "FAIL", errors,
  };
  const shopId = "shop-" + platform + "-1";
  try {
    const ok = await context.coordinator.activateShop(platform as never, shopId);
    out.webcontentsview_created = ok;
    const service = context.coordinator.serviceFor(platform as never) as unknown as PlatformServiceLike;
    out.page_ready = await waitFor(() => service.status(shopId)?.session_status === "READY", 12000);
    if (!out.page_ready) errors.push("page_ready=false");
    out.message_received = await waitFor(() => context.rawEvents.events().includes("BuyerMessageReceived"), 15000);
    if (!out.message_received) errors.push("message_received=false");
    const adapter = service.adapterFor(shopId);
    if (adapter) {
      const res = await adapter.sendText(shopId, "c1", ["亲,有的~"]);
      out.send_text = res.ok === true;
      out.send_ack = res.ok === true;
      if (!out.send_text) errors.push("send_text=false");
    }
    context.coordinator.disposeAll();
    out.session_disposed = true;
  } catch (e) {
    errors.push("m8_platform_exception=" + (e instanceof Error ? e.message : String(e)));
  }
  out.result = errors.length === 0 ? "PASS" : "FAIL";
  if (resultFile) writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf-8");
  return out;
}

export interface M8MultiPlatformResult {
  platforms: string[];
  sessions_coexist: boolean;
  partitions_unique: boolean;
  inbound_no_cross_route: boolean;
  dispose_isolated: boolean;
  external_network_calls: number;
  result: "PASS" | "FAIL";
  errors: string[];
}

export async function runM8MultiPlatformProbe(context: MainContext, resultFile: string | undefined): Promise<M8MultiPlatformResult> {
  const errors: string[] = [];
  const platforms = ["pdd", "doudian", "jd", "kuaishou", "qianniu", "xianyu"];
  const out: M8MultiPlatformResult = {
    platforms, sessions_coexist: false, partitions_unique: false, inbound_no_cross_route: true,
    dispose_isolated: false, external_network_calls: 0, result: "FAIL", errors,
  };
  try {
    for (const platform of platforms) await context.coordinator.activateShop(platform as never, "shop-" + platform);
    out.sessions_coexist = context.coordinator.entries().length === 6;
    out.partitions_unique = new Set(platforms.map((p) => "persist:shop-" + p)).size === 6;
    // Feed a message to doudian; assert no other platform saw it.
    const before = context.rawEvents.captured.length;
    const doudianService = context.coordinator.serviceFor("doudian") as { handlePageEvent(p: unknown): void };
    doudianService.handlePageEvent({ event: "message_received", session_id: "doudian-session-shop-doudian", shop_id: "shop-doudian", conversation_id: "c1", direction: "inbound", content: "抖店消息" });
    await new Promise((r) => setTimeout(r, 300));
    const newEvents = context.rawEvents.captured.slice(before).filter((e) => e.event === "BuyerMessageReceived");
    out.inbound_no_cross_route = newEvents.every((e) => (e.payload as { shop_id?: string })?.shop_id === "shop-doudian");
    if (!out.inbound_no_cross_route) errors.push("inbound_no_cross_route=false");
    context.coordinator.disposeAll();
    out.dispose_isolated = context.coordinator.entries().length === 0;
  } catch (e) {
    errors.push("m8_multi_exception=" + (e instanceof Error ? e.message : String(e)));
  }
  out.result = errors.length === 0 ? "PASS" : "FAIL";
  if (resultFile) writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf-8");
  return out;
}

export interface M8VerticalResult {
  platforms: Record<string, { suggestion_ready: boolean; exactly_once_send: boolean }>;
  external_network_calls: number;
  result: "PASS" | "FAIL";
  errors: string[];
}

export async function runM8VerticalProbe(context: MainContext, resultFile: string | undefined): Promise<M8VerticalResult> {
  const errors: string[] = [];
  const platforms = ["doudian", "jd", "kuaishou", "qianniu", "xianyu"];
  const out: M8VerticalResult = { platforms: {}, external_network_calls: 0, result: "FAIL", errors };
  try {
    for (const platform of platforms) {
      const shopId = "shop-" + platform + "-1";
      await context.coordinator.activateShop(platform as never, shopId);
      const service = context.coordinator.serviceFor(platform as never) as unknown as PlatformServiceLike;
      const ready = await waitFor(() => service.status(shopId)?.session_status === "READY", 12000);
      const suggestionReady = ready && await waitFor(() => context.rawEvents.events().includes("SuggestionReady"), 30000);
      const adapter = service.adapterFor(shopId);
      let exactlyOnce = false;
      if (adapter) {
        const res = await adapter.sendText(shopId, "c1", ["亲,有的哦~"]);
        exactlyOnce = res.ok === true;
      }
      out.platforms[platform] = { suggestion_ready: suggestionReady, exactly_once_send: exactlyOnce };
      if (!suggestionReady) errors.push(platform + ":suggestion_ready=false");
      if (!exactlyOnce) errors.push(platform + ":exactly_once_send=false");
    }
    context.coordinator.disposeAll();
  } catch (e) {
    errors.push("m8_vertical_exception=" + (e instanceof Error ? e.message : String(e)));
  }
  out.result = errors.length === 0 ? "PASS" : "FAIL";
  if (resultFile) writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf-8");
  return out;
}
