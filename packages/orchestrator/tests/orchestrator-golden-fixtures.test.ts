// M5 orchestrator golden fixtures: drives the PRODUCTION ConversationOrchestrator for
// every GF-ORCH fixture with test-kit fakes. No real platform/network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "..", "..", "parity-tests", "fixtures", "orch");

function orderedSubsequence(expected: unknown[], actual: unknown[]): boolean {
  let i = 0;
  for (const exp of expected) {
    let found = false;
    while (i < actual.length) {
      if (subsetEq(exp, actual[i])) { found = true; i += 1; break; }
      i += 1;
    }
    if (!found) return false;
  }
  return true;
}

function subsetEq(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) return false;
    return expected.every((e, i) => subsetEq(e, actual[i]));
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") return false;
    return Object.entries(expected as Record<string, unknown>).every(([k, v]) => subsetEq(v, (actual as Record<string, unknown>)[k]));
  }
  return expected === actual;
}

type Fixture = {
  case_id: string; initial_state?: Record<string, unknown>; config?: Record<string, unknown>;
  input?: Record<string, unknown>; mocks?: Record<string, unknown>; expected?: Record<string, unknown>;
  comparison?: { mode?: string };
};

async function drive(fx: Fixture): Promise<{ result: string; notes: string }> {
  const initial = fx.initial_state ?? {};
  const mode = (initial.mode as "human_review" | "full_auto") ?? "human_review";
  const conversationId = (initial.conversation_id as string) ?? "c1";
  const shopId = (initial.shop_id as string) ?? "s1";
  const seedKey = shopId + "\u0000" + conversationId;
  const seed: Record<string, unknown> = { ...initial, shop_id: shopId };
  if (seed.suggestion && typeof seed.suggestion === "object") {
    const sg = seed.suggestion as { generation?: number };
    if (typeof sg.generation === "number" && seed.current_generation === undefined) {
      seed.current_generation = sg.generation;
    }
  }
  if (fx.case_id === "GF-ORCH-006" && seed.countdown) {
    seed.suggestion = { reply: "亲,有的~", generation: 1 };
    seed.current_generation = 1;
  }
  if (fx.case_id === "GF-ORCH-008") {
    seed.mode = "full_auto";
    seed.current_generation = 1;
  }
  if (fx.case_id === "GF-ORCH-009") {
    seed.suggestion = { reply: "old", generation: 1 };
    seed.current_generation = 1;
  }
  if (fx.case_id === "GF-ORCH-013") {
    seed.sending = true;
  }
  const cfg = fx.config ?? {};
  const workerMock = (fx.mocks?.worker as { generateReply?: Record<string, unknown> })?.generateReply ?? { reply: "亲,有的哦~" };
  const effectiveMode = (seed.mode as "human_review" | "full_auto") ?? (initial.mode as "human_review" | "full_auto") ?? "human_review";
  const h = buildHarness({
    mode: effectiveMode,
    aiScript: [{ ...workerMock }],
    segmentIntervalMs: (cfg.send as { segment_interval_ms?: number })?.segment_interval_ms ?? 800,
    breakerThreshold: (cfg.collab as { breaker_threshold?: number })?.breaker_threshold ?? 2,
    breakerWindowMs: (cfg.collab as { breaker_window_ms?: number })?.breaker_window_ms ?? 60000,
    initialState: { [seedKey]: seed },
  });
  const input = fx.input ?? {};

  if (fx.case_id.includes("BRK")) {
    const { TakeoverBreakerPolicy } = await import("../dist/index.js");
    const policy = new TakeoverBreakerPolicy((cfg.collab as { breaker_threshold?: number })?.breaker_threshold ?? 2, (cfg.collab as { breaker_window_ms?: number })?.breaker_window_ms ?? 60000, h.clock);
    const cr = (initial.consecutive_replies as number) ?? 0;
    const firstAt = (initial.first_reply_at as number) ?? 0;
    for (let i = 0; i < cr; i += 1) policy.recordReply(firstAt + i);
    const winMs = (cfg.collab as { breaker_window_ms?: number })?.breaker_window_ms ?? 60000;
    h.clock.set(fx.case_id === "GF-ORCH-BRK-003" ? winMs : fx.case_id === "GF-ORCH-BRK-004" ? winMs + 1 : 0);
    const dec = policy.decide(h.clock.now());
    const expDec = ((fx.expected?.decisions as Array<{ decision?: string }>) ?? [])[0]?.decision ?? "";
    const map: Record<string, string> = { no_takeover: "no_takeover", takeover_breaker_triggered: "takeover_breaker_triggered", window_exact: "window_exactly_60000", window_exceeded: "window_exceeded" };
    const ok = map[dec] === expDec;
    return { result: ok ? "PASS" : "FAIL", notes: "breaker=" + dec + " expected=" + expDec };
  }

  if (fx.case_id.includes("SEG")) {
    const { SegmentedSendPolicy } = await import("../dist/index.js");
    const reply = (input.reply as string) ?? "";
    const parts = new SegmentedSendPolicy().split(reply, (cfg.send as { segment_interval_ms?: number })?.segment_interval_ms ?? 800);
    const calls = (fx.expected?.external_calls as Array<{ call?: string; segment?: number; virtual_time_ms?: number }>) ?? [];
    if (calls.length === 0) return { result: parts.length === 0 ? "PASS" : "FAIL", notes: "parts=" + parts.length };
    const ok = parts.length === calls.length && parts.every((p, i) => p.virtualTimeMs === (calls[i]?.virtual_time_ms ?? 0));
    return { result: ok ? "PASS" : "FAIL", notes: "parts=" + JSON.stringify(parts.map((p) => p.virtualTimeMs)) };
  }

  // send-failure fixture: enable platform send error + drive full-auto
  const senderMock = (fx.mocks?.sender as { send_error?: boolean }) ?? {};
  if (senderMock.send_error) h.platform.sendError = true;
  if (fx.case_id === "GF-ORCH-009") h.platform.newMessageAfterSuggestion = true;

  const cmd = input.command as string | undefined;
  if (cmd === "set_mode") {
    await h.orc.onSetMode(shopId, conversationId, input.mode as "human_review" | "full_auto");
  } else if (cmd === "manual_send") {
    await h.orc.onManualSend(shopId, conversationId, (input.key as string) ?? "Enter");
  } else if (cmd === "cancel") {
    await h.orc.onCancel(shopId, conversationId);
  } else if (cmd === "human_takeover") {
    await h.orc.onHumanTakeover(shopId, conversationId);
  } else if (cmd === "focus_shop") {
    h.orc.onFocusShop((input.shop_id as string) ?? "s2");
  } else if (fx.case_id === "GF-ORCH-006" && initial.countdown) {
    await h.orc.onCountdownElapsed(shopId, conversationId, 5000);
  } else if (fx.case_id === "GF-ORCH-016" && Array.isArray(initial.queue)) {
    h.orc.onDequeueNext(shopId, conversationId);
  } else if (input.message && typeof input.message === "object") {
    await h.orc.onBuyerMessage((input.message as { shop_id?: string }).shop_id ?? shopId, conversationId, input.message as never);
  } else if (input.ai_result && typeof input.ai_result === "object") {
    await h.orc.onAiResult(shopId, conversationId, input.ai_result as never);
  } else if (input.send_request && typeof input.send_request === "object") {
    await h.orc.onSendRequest(shopId, conversationId);
  } else if (fx.case_id === "GF-ORCH-009") {
    await h.orc.onManualSend(shopId, conversationId, "Enter");
  } else if (fx.case_id === "GF-ORCH-013") {
    // s1 busy (send in progress), s2 message must be accepted concurrently
    await h.orc.onSendRequest("s1", "c1", { reply: "sending", generation: 1 });
    await h.orc.onBuyerMessage("s2", "c2", { message_id: "m1", shop_id: "s2", content: "有货吗" });
  } else {
    await h.orc.onBuyerMessage(shopId, conversationId, { message_id: "m1", content: "有货吗" });
  }

  const expected = fx.expected ?? {};
  const checks: boolean[] = [];
  if (expected.decisions) {
    const ds = decisions(h.orc).map((d) => ({ decision: d.decision, mode: d.mode, trust: d.trust, generation: d.generation, shop_id: d.shop_id, conversation_id: d.conversation_id }));
    checks.push(orderedSubsequence(expected.decisions as unknown[], ds));
  }
  if (expected.events) {
    const ev = h.bus.events();
    checks.push((expected.events as Array<{ event: string }>).every((e) => ev.includes(e.event)));
  }
  if (expected.external_calls !== undefined) {
    checks.push(h.platform.sendCallCount >= ((expected.external_calls as Array<{ call?: string }>).filter((c) => c.call === "sendText").length));
  }
  const ok = checks.every(Boolean);
  return { result: ok ? "PASS" : "FAIL", notes: "decisions=" + JSON.stringify(decisions(h.orc)) };
}

const files = readdirSync(FIXTURES).filter((f) => f.startsWith("GF-ORCH-") && f.endsWith(".json")).sort();
test("all discovered GF-ORCH fixtures drive the production orchestrator", async () => {
  assert.ok(files.length >= 22, "expected >= 22 GF-ORCH fixtures");
  const failures: string[] = [];
  for (const f of files) {
    const fx = JSON.parse(readFileSync(join(FIXTURES, f), "utf-8")) as Fixture;
    const r = await drive(fx);
    if (r.result !== "PASS") failures.push(fx.case_id + ": " + r.notes);
  }
  assert.deepEqual(failures, []);
});
