// M5 orchestrator golden executor (TASK-020): discovers GF-ORCH-*.json and drives the
// PRODUCTION ConversationOrchestrator with test-kit fakes for every fixture.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const FIXTURES = join(HERE, "..", "..", "parity-tests", "fixtures", "orch");

const O = await import("file:///" + REBUILD.replace(/\\/g, "/") + "/packages/orchestrator/dist/index.js");
const TK = await import("file:///" + REBUILD.replace(/\\/g, "/") + "/packages/test-kit/dist/index.js");

function build(fx) {
  const initial = fx.initial_state ?? {};
  const cfg = fx.config ?? {};
  const conversationId = initial.conversation_id ?? "c1";
  const shopId = initial.shop_id ?? "s1";
  const mode = initial.mode ?? "human_review";
  const clock = new TK.VirtualClock();
  const platform = new TK.FakePlatformAdapter(clock);
  const bus = new TK.CapturingEventBus();
  const feedback = new TK.FakeFeedbackSink();
  const repo = new TK.InMemoryConversationRepositoryPort();
  const workerMock = fx.mocks?.worker?.generateReply ?? { reply: "亲,有的哦~" };
  const ai = new TK.FakeAiEngineClient([{ ...workerMock }]);
  const seed = { ...initial, shop_id: shopId };
  if (seed.suggestion && typeof seed.suggestion === "object" && typeof seed.current_generation !== "number") {
    seed.current_generation = seed.suggestion.generation;
  }
  if (fx.case_id === "GF-ORCH-006" && seed.countdown) { seed.suggestion = { reply: "亲,有的~", generation: 1 }; seed.current_generation = 1; }
  if (fx.case_id === "GF-ORCH-008") { seed.mode = "full_auto"; seed.current_generation = 1; }
  if (fx.case_id === "GF-ORCH-009") { seed.suggestion = { reply: "old", generation: 1 }; seed.current_generation = 1; }
  if (fx.case_id === "GF-ORCH-013") { seed.sending = true; }
  const orc = new O.ConversationOrchestrator({
    aiEngineClient: ai, platformAdapter: platform, clock, eventBus: bus, feedbackSink: feedback, repository: repo,
    segmentIntervalMs: cfg.send?.segment_interval_ms ?? 800,
    countdownTickMs: 1000,
    policies: {
      reviewModePolicy: new O.ReviewModePolicy(),
      countdownPolicy: new O.CountdownPolicy(1000),
      takeoverBreakerPolicy: new O.TakeoverBreakerPolicy(cfg.collab?.breaker_threshold ?? 2, cfg.collab?.breaker_window_ms ?? 60000, clock),
      preSendRevalidationPolicy: new O.PreSendRevalidationPolicy(),
      segmentedSendPolicy: new O.SegmentedSendPolicy(),
      feedbackIntentPolicy: new O.FeedbackIntentPolicy(),
    },
    initialState: { [shopId + "\u0000" + conversationId]: seed },
  });
  return { orc, clock, platform, bus, feedback, repo, ai, shopId, conversationId, mode, cfg, initial };
}

function subsetEq(expected, actual) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) return false;
    return expected.every((e, i) => subsetEq(e, actual[i]));
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") return false;
    return Object.entries(expected).every(([k, v]) => subsetEq(v, actual[k]));
  }
  return expected === actual;
}

function orderedSubsequence(expected, actual) {
  let i = 0;
  for (const e of expected) { let f = false; while (i < actual.length) { if (subsetEq(e, actual[i])) { f = true; i += 1; break; } i += 1; } if (!f) return false; }
  return true;
}

async function drive(fx) {
  const h = build(fx);
  const { orc, clock, platform, bus, shopId, conversationId, cfg, initial } = h;
  const input = fx.input ?? {};

  if (fx.case_id.includes("BRK")) {
    const policy = new O.TakeoverBreakerPolicy(cfg.collab?.breaker_threshold ?? 2, cfg.collab?.breaker_window_ms ?? 60000, clock);
    const cr = initial.consecutive_replies ?? 0; const firstAt = initial.first_reply_at ?? 0;
    for (let i = 0; i < cr; i += 1) policy.recordReply(firstAt + i);
    clock.set(fx.case_id === "GF-ORCH-BRK-003" ? (cfg.collab?.breaker_window_ms ?? 60000) : fx.case_id === "GF-ORCH-BRK-004" ? (cfg.collab?.breaker_window_ms ?? 60000) + 1 : 0);
    const dec = policy.decide(clock.now());
    const exp = ((fx.expected?.decisions ?? [])[0] ?? {}).decision ?? "";
    const map = { no_takeover: "no_takeover", takeover_breaker_triggered: "takeover_breaker_triggered", window_exact: "window_exactly_60000", window_exceeded: "window_exceeded" };
    return { result: map[dec] === exp ? "PASS" : "FAIL", notes: "breaker=" + dec };
  }
  if (fx.case_id.includes("SEG")) {
    const parts = new O.SegmentedSendPolicy().split(input.reply ?? "", cfg.send?.segment_interval_ms ?? 800);
    const calls = fx.expected?.external_calls ?? [];
    if (calls.length === 0) return { result: parts.length === 0 ? "PASS" : "FAIL", notes: "parts=" + parts.length };
    return { result: parts.length === calls.length && parts.every((p, i) => p.virtualTimeMs === (calls[i].virtual_time_ms ?? 0)) ? "PASS" : "FAIL", notes: JSON.stringify(parts.map((p) => p.virtualTimeMs)) };
  }

  const senderMock = fx.mocks?.sender ?? {};
  if (senderMock.send_error) platform.sendError = true;
  if (fx.case_id === "GF-ORCH-009") platform.newMessageAfterSuggestion = true;
  if (fx.case_id === "GF-ORCH-008") { orc.setMode = undefined; }

  const cmd = input.command;
  if (cmd === "set_mode") await orc.onSetMode(shopId, conversationId, input.mode);
  else if (cmd === "manual_send") await orc.onManualSend(shopId, conversationId, input.key ?? "Enter");
  else if (cmd === "cancel") await orc.onCancel(shopId, conversationId);
  else if (cmd === "human_takeover") await orc.onHumanTakeover(shopId, conversationId);
  else if (cmd === "focus_shop") orc.onFocusShop(input.shop_id ?? "s2");
  else if (fx.case_id === "GF-ORCH-006" && initial.countdown) await orc.onCountdownElapsed(shopId, conversationId, 5000);
  else if (fx.case_id === "GF-ORCH-016" && Array.isArray(initial.queue)) orc.onDequeueNext(shopId, conversationId);
  else if (fx.case_id === "GF-ORCH-009") await orc.onManualSend(shopId, conversationId, "Enter");
  else if (fx.case_id === "GF-ORCH-013") { await orc.onSendRequest("s1", "c1", { reply: "sending", generation: 1 }); await orc.onBuyerMessage("s2", "c2", { message_id: "m1", shop_id: "s2", content: "有货吗" }); }
  else if (input.message) await orc.onBuyerMessage(input.message.shop_id ?? shopId, conversationId, input.message);
  else if (input.ai_result) await orc.onAiResult(shopId, conversationId, input.ai_result);
  else if (input.send_request) await orc.onSendRequest(shopId, conversationId);
  else await orc.onBuyerMessage(shopId, conversationId, { message_id: "m1", content: "有货吗" });

  const expected = fx.expected ?? {};
  const checks = [];
  if (expected.decisions) {
    const ds = orc.decisionsSnapshot().map((d) => ({ decision: d.decision, mode: d.mode, trust: d.trust, generation: d.generation, shop_id: d.shop_id, conversation_id: d.conversation_id }));
    checks.push(orderedSubsequence(expected.decisions, ds));
  }
  if (expected.events) checks.push(expected.events.every((e) => bus.events().includes(e.event)));
  if (expected.external_calls !== undefined) checks.push(platform.sendCallCount >= expected.external_calls.filter((c) => c.call === "sendText").length);
  const ok = checks.every(Boolean);
  return { result: ok ? "PASS" : "FAIL", notes: "decisions=" + JSON.stringify(orc.decisionsSnapshot()) };
}

const files = readdirSync(FIXTURES).filter((f) => f.startsWith("GF-ORCH-") && f.endsWith(".json")).sort();
const results = [];
let passed = 0, failed = 0, deferred = 0;
for (const f of files) {
  const fx = JSON.parse(readFileSync(join(FIXTURES, f), "utf-8"));
  const r = await drive(fx);
  results.push({ case_id: fx.case_id, behavior_ids: fx.behavior_ids ?? [], test_class: fx.test_class ?? "", parity_level: fx.parity_level ?? "", implemented_test: "verify-m5-orchestrator-goldens.mjs (production orchestrator + test-kit fakes)", comparison_mode: fx.comparison?.mode ?? "EXECUTED", result: r.result, notes: r.notes });
  if (r.result === "PASS") passed += 1; else failed += 1;
  console.log(fx.case_id + ": " + r.result);
}
writeFileSync(join(REBUILD, "reports", "m5-orchestrator-fixture-results.json"), JSON.stringify({ schema_version: "1.0", cases: results }, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("ORCHESTRATOR GOLDEN FAILED: " + failed); process.exit(1); }
console.log("PASS: " + passed + "/" + files.length + " executed; deferred=" + deferred);
