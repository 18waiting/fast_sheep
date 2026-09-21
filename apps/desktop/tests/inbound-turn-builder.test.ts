// SHEEP-303 Inbound Aggregation / Turn Builder - focused tests.
//
// Scope: aggregation behaviour and the surrounding boundaries. Deterministic time only: every timing
// assertion is driven by `@fastwork/test-kit` VirtualClock, never by a real sleep or wall clock.
// No AI, no send, no persistence, no schema change is involved in this unit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { VirtualClock } from "@fastwork/test-kit";
import {
  createInboundTurnBuilder,
  TURN_QUIET_WINDOW_DEFAULT_MS,
  TURN_QUIET_WINDOW_MAX_MS,
  TURN_QUIET_WINDOW_MIN_MS,
} from "../dist/main/services/inbound-turn-builder.js";

/** Deterministic expiry driver: the test decides exactly when a tick happens (no real timers). */
function fakeScheduler() {
  let tick = null;
  let started = 0;
  let stopped = 0;
  return {
    scheduler: {
      start(onTick) { tick = onTick; started += 1; },
      stop() { stopped += 1; tick = null; },
    },
    tickNow() { if (tick === null) throw new Error("scheduler not running"); tick(); },
    isRunning: () => tick !== null,
    counts: () => ({ started, stopped }),
  };
}
import { createMainContext } from "../dist/main/bootstrap.js";

const SCOPE = { merchantId: "merchant-1", storeId: "store-1", platformAccountId: "account-1" };
const OTHER_STORE = { merchantId: "merchant-1", storeId: "store-2", platformAccountId: "account-2" };

function request(overrides = {}) {
  const { receipt, ...rest } = overrides;
  return {
    receipt: { status: "INGESTED", conversationId: "conversation:account-1:2318082461", messageId: "m-1", ...(receipt ?? {}) },
    platform: "pdd",
    scope: SCOPE,
    customerId: "2318082461",
    observedAt: "2026-09-21T00:00:00.000Z",
    actor: "customer",
    contentKind: "text",
    contentText: "你好",
    ...rest,
  };
}

function harness(options = {}) {
  const clock = new VirtualClock();
  const turns = [];
  const driver = fakeScheduler();
  const builder = createInboundTurnBuilder({
    enabled: options.enabled !== false,
    clock,
    scheduler: driver.scheduler,
    ...(options.quietWindowMs === undefined ? {} : { quietWindowMs: options.quietWindowMs }),
    onTurn: options.onTurn ?? ((turn) => turns.push(turn)),
  });
  return { clock, builder, turns, driver };
}

test("3 consecutive messages from one customer in one store form ONE turn with 3 stable source ids", () => {
  const { clock, builder } = harness();
  const at = (seconds) => ("2026-09-21T00:00:0" + String(seconds) + ".000Z");
  // In-memory arrival order deliberately differs from the ordering keys, so the sort is exercised.
  assert.equal(builder.ingest(request({ receipt: { messageId: "m-3" }, observedAt: at(2), contentText: "什么时候发货" })).status, "AGGREGATED");
  assert.equal(builder.ingest(request({ receipt: { messageId: "m-1" }, observedAt: at(0), contentText: "你好" })).status, "AGGREGATED");
  assert.equal(builder.ingest(request({ receipt: { messageId: "m-2" }, observedAt: at(1), contentText: "我想问一下" })).status, "AGGREGATED");

  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS - 1);
  assert.deepEqual(builder.poll(), [], "the window is still open just before the quiet window elapses");
  clock.advance(1);
  const emitted = builder.poll();
  assert.equal(emitted.length, 1, "exactly one turn for the three messages");
  const turn = emitted[0];
  assert.deepEqual(turn.source_message_ids, ["m-1", "m-2", "m-3"], "source ids sorted by observedAt");
  assert.deepEqual(turn.source_observed_at, [at(0), at(1), at(2)]);
  assert.equal(turn.newness, "NEWNESS_UNVERIFIED");
  assert.equal(turn.automaticProcessingEligible, false);
  assert.equal(turn.identity_lock.conversationId, "conversation:account-1:2318082461");
  assert.equal(builder.diagnostics().emittedTurns, 1);
  assert.equal(builder.turns().length, 1);
});

test("equal observedAt preserves RECEIPT ARRIVAL order (a derived id must not reorder the questions)", () => {
  // observedAt has millisecond resolution: a burst can share one timestamp. Ordering those by a
  // derived id would reverse the customer''s question order (found by the integration test).
  const { clock, builder, driver } = harness();
  const same = "2026-09-21T00:00:00.000Z";
  builder.ingest(request({ receipt: { messageId: "zzz-first-arrival" }, observedAt: same }));
  builder.ingest(request({ receipt: { messageId: "aaa-second-arrival" }, observedAt: same }));
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  driver.tickNow();
  const turn = builder.turns()[0];
  assert.deepEqual(turn.source_message_ids, ["zzz-first-arrival", "aaa-second-arrival"], "arrival order wins over id order");
});

test("a later observedAt sorts before an earlier arrival only when the timestamp differs", () => {
  const { clock, builder, driver } = harness();
  builder.ingest(request({ receipt: { messageId: "m-late-arrival" }, observedAt: "2026-09-21T00:00:05.000Z" }));
  builder.ingest(request({ receipt: { messageId: "m-early-arrival" }, observedAt: "2026-09-21T00:00:01.000Z" }));
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  driver.tickNow();
  const turn = builder.turns()[0];
  assert.deepEqual(turn.source_message_ids, ["m-early-arrival", "m-late-arrival"], "observedAt is the primary ordering key");
});

test("two customers form two separate turns (no cross-customer merge)", () => {
  const { clock, builder } = harness();
  builder.ingest(request({ receipt: { messageId: "a-1", conversationId: "conversation:account-1:111" }, customerId: "111", contentText: "你好" }));
  builder.ingest(request({ receipt: { messageId: "b-1", conversationId: "conversation:account-1:222" }, customerId: "222", contentText: "在吗" }));
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  const emitted = builder.poll();
  assert.equal(emitted.length, 2);
  assert.deepEqual(emitted.map((t) => t.source_message_ids).flat().sort(), ["a-1", "b-1"]);
  assert.equal(new Set(emitted.map((t) => t.identity_lock.customerId)).size, 2);
  assert.equal(new Set(emitted.map((t) => t.identity_lock.conversationId)).size, 2);
});

test("two stores form two separate turns (no cross-store merge)", () => {
  const { clock, builder } = harness();
  builder.ingest(request({ receipt: { messageId: "s1-1" } }));
  builder.ingest(request({ receipt: { messageId: "s2-1", conversationId: "conversation:account-2:2318082461" }, scope: OTHER_STORE }));
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  const emitted = builder.poll();
  assert.equal(emitted.length, 2);
  assert.deepEqual(emitted.map((t) => t.identity_lock.storeId).sort(), ["store-1", "store-2"]);
  assert.deepEqual(emitted.map((t) => t.source_message_ids).flat().sort(), ["s1-1", "s2-1"]);
});

test("DUPLICATE receipt never creates a turn (only counted)", () => {
  const { clock, builder } = harness();
  const outcome = builder.ingest(request({ receipt: { status: "DUPLICATE", messageId: "m-1" } }));
  assert.equal(outcome.status, "DROPPED");
  assert.equal(outcome.reason, "NOT_INGESTED_RECEIPT");
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS * 3);
  assert.deepEqual(builder.poll(), []);
  const diagnostics = builder.diagnostics();
  assert.equal(diagnostics.droppedDuplicateReceipts, 1);
  assert.equal(diagnostics.emittedTurns, 0);
  assert.equal(diagnostics.ingestedReceipts, 0);
});

test("a repeated INGESTED for the same message identity does not duplicate the source id", () => {
  const { clock, builder } = harness();
  assert.equal(builder.ingest(request({ receipt: { messageId: "m-1" } })).status, "AGGREGATED");
  const again = builder.ingest(request({ receipt: { messageId: "m-1" } }));
  assert.equal(again.status, "REFUSED");
  assert.equal(again.reason, "DUPLICATE_MESSAGE_ID");
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  const emitted = builder.poll();
  assert.equal(emitted.length, 1);
  assert.deepEqual(emitted[0].source_message_ids, ["m-1"], "no duplicate turn and no duplicated source id");
});

test("messages separated by more than the quiet window form different turns", () => {
  const { clock, builder } = harness();
  builder.ingest(request({ receipt: { messageId: "m-1" }, observedAt: "2026-09-21T00:00:00.000Z" }));
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  assert.equal(builder.poll().length, 1, "first window closes");
  builder.ingest(request({ receipt: { messageId: "m-2" }, observedAt: "2026-09-21T00:00:10.000Z" }));
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  const second = builder.poll();
  assert.equal(second.length, 1);
  assert.deepEqual(second[0].source_message_ids, ["m-2"]);
  assert.equal(builder.diagnostics().emittedTurns, 2);
});

test("VirtualClock drives the window: no real sleep, and created_at follows the injected clock", () => {
  const { clock, builder } = harness();
  clock.set(1_700_000_000_000);
  builder.ingest(request());
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  const turn = builder.poll()[0];
  assert.equal(turn.created_at, new Date(1_700_000_000_000 + TURN_QUIET_WINDOW_DEFAULT_MS).toISOString());
});

test("quiet window is clamped to the 3-5 second product target", () => {
  const tooSmall = createInboundTurnBuilder({ enabled: true, quietWindowMs: 10, clock: new VirtualClock() });
  const tooLarge = createInboundTurnBuilder({ enabled: true, quietWindowMs: 600000, clock: new VirtualClock() });
  assert.equal(tooSmall.diagnostics().quietWindowMs, TURN_QUIET_WINDOW_MIN_MS);
  assert.equal(tooLarge.diagnostics().quietWindowMs, TURN_QUIET_WINDOW_MAX_MS);
  assert.equal(createInboundTurnBuilder({ enabled: true }).diagnostics().quietWindowMs, TURN_QUIET_WINDOW_DEFAULT_MS);
});

test("a scope change inside an open window does not merge into the original turn", () => {
  const { clock, builder } = harness();
  builder.ingest(request({ receipt: { messageId: "m-1" } }));
  const changed = builder.ingest(request({ receipt: { messageId: "m-2" }, scope: OTHER_STORE }));
  assert.equal(changed.status, "REFUSED");
  assert.equal(changed.reason, "IDENTITY_WINDOW_CONFLICT");
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  const emitted = builder.poll();
  assert.equal(emitted.length, 1);
  assert.deepEqual(emitted[0].source_message_ids, ["m-1"], "the original turn keeps only its own scope messages");
  assert.equal(emitted[0].identity_lock.storeId, "store-1");
});

test("an identity change inside an open window does not merge into the original turn", () => {
  const { clock, builder } = harness();
  builder.ingest(request({ receipt: { messageId: "m-1" } }));
  const changed = builder.ingest(request({ receipt: { messageId: "m-2" }, customerId: "999" }));
  assert.equal(changed.status, "REFUSED");
  assert.equal(changed.reason, "IDENTITY_WINDOW_CONFLICT");
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  const emitted = builder.poll();
  assert.equal(emitted.length, 1);
  assert.deepEqual(emitted[0].source_message_ids, ["m-1"]);
  assert.equal(emitted[0].identity_lock.customerId, "2318082461");
});

test("UNKNOWN or incomplete scope fails closed with an explicit reason", () => {
  const { builder } = harness();
  const cases = [
    [{ scope: { merchantId: null, storeId: "store-1", platformAccountId: "account-1" } }, "SCOPE_INCOMPLETE"],
    [{ scope: { merchantId: "merchant-1", storeId: null, platformAccountId: "account-1" } }, "SCOPE_INCOMPLETE"],
    [{ scope: { merchantId: "merchant-1", storeId: "store-1", platformAccountId: null } }, "SCOPE_INCOMPLETE"],
    [{ platform: null }, "SCOPE_INCOMPLETE"],
    [{ receipt: { conversationId: "" } }, "SCOPE_INCOMPLETE"],
    [{ observedAt: null }, "OBSERVED_AT_UNKNOWN"],
  ];
  for (const [overrides, reason] of cases) {
    const outcome = builder.ingest(request(overrides));
    assert.equal(outcome.status, "REFUSED", JSON.stringify(overrides));
    assert.equal(outcome.reason, reason, JSON.stringify(overrides));
  }
  assert.equal(builder.diagnostics().aggregatedMessages, 0, "nothing was aggregated");
  assert.equal(builder.diagnostics().openWindows, 0);
});

test("non-customer actor and non-text content are refused (never treated as an inbound question)", () => {
  const { builder } = harness();
  assert.equal(builder.ingest(request({ actor: "agent" })).reason, "NON_CUSTOMER_ACTOR");
  assert.equal(builder.ingest(request({ contentKind: "image" })).reason, "NON_TEXT_CONTENT");
  assert.equal(builder.ingest(request({ contentText: null })).reason, "CONTENT_MISSING");
  assert.equal(builder.diagnostics().aggregatedMessages, 0);
});

test("multi-question: every accepted message keeps its own id, and empty content can never enter a turn", () => {
  // Unit-level contract only. Content recoverability is proven against the canonical persistence rows
  // in `inbound-turn-builder.integration.test.ts` (a unit test has no store to read back from).
  const { clock, builder, driver } = harness();
  const questions = ["你好", "我想问一下", "什么时候发货", "另外可以开发票吗", "发顺丰吗"];
  questions.forEach((text, index) => {
    assert.equal(builder.ingest(request({ receipt: { messageId: "q-" + index }, observedAt: "2026-09-21T00:00:0" + index + ".000Z", contentText: text })).status, "AGGREGATED");
  });
  // A blank content can never be aggregated, so a turn can never contain a content-less message.
  assert.equal(builder.ingest(request({ receipt: { messageId: "q-empty" }, contentText: "   " })).reason, "CONTENT_MISSING");

  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  driver.tickNow();
  const turn = builder.turns()[0];
  assert.deepEqual(turn.source_message_ids, ["q-0", "q-1", "q-2", "q-3", "q-4"], "every accepted message id is kept, in order");
  assert.equal(turn.source_message_ids.length, questions.length, "no id was merged away or dropped");
});

test("the emitted turn is always NEWNESS_UNVERIFIED and never automatically processable", () => {
  const { clock, builder } = harness();
  builder.ingest(request());
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  const turn = builder.poll()[0];
  assert.equal(turn.newness, "NEWNESS_UNVERIFIED");
  assert.strictEqual(turn.automaticProcessingEligible, false);
  assert.deepEqual(Object.keys(turn).sort(), [
    "automaticProcessingEligible", "created_at", "identity_lock", "newness", "source_message_ids", "source_observed_at", "turn_id",
  ], "the turn carries no prompt, no reply and no execution field");
});

test("AI calls, send calls and production writes stay at 0", () => {
  const { clock, builder } = harness();
  builder.ingest(request());
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  builder.poll();
  const diagnostics = builder.diagnostics();
  assert.equal(diagnostics.aiCalls, 0);
  assert.equal(diagnostics.sendCalls, 0);
  assert.equal(diagnostics.productionWrites, 0);
  // Structural evidence: the builder exposes no AI / send / persistence port at all.
  assert.deepEqual(Object.keys(builder).sort(), ["diagnostics", "enabled", "ingest", "poll", "stop", "turns"]);
});

test("a disabled builder is inert: nothing is aggregated and no turn can be emitted", () => {
  const { clock, builder } = harness({ enabled: false });
  const outcome = builder.ingest(request());
  assert.equal(outcome.status, "REFUSED");
  assert.equal(outcome.reason, "TURN_AGGREGATION_DISABLED");
  clock.advance(TURN_QUIET_WINDOW_MAX_MS * 10);
  assert.deepEqual(builder.poll(), []);
  const diagnostics = builder.diagnostics();
  assert.equal(diagnostics.enabled, false);
  assert.equal(diagnostics.aggregatedMessages, 0);
  assert.equal(diagnostics.emittedTurns, 0);
});

test("bootstrap wiring: aggregation is DEFAULT OFF and the production path is unchanged", () => {
  const context = createMainContext({ testMode: true });
  assert.equal(context.inboundTurns.enabled, false, "no aggregation unless Main explicitly enables it");
  const refused = context.inboundTurns.ingest(request());
  assert.equal(refused.status, "REFUSED");
  assert.equal(refused.reason, "TURN_AGGREGATION_DISABLED");
  assert.equal(context.inboundTurns.turns().length, 0);
  assert.equal(context.inboundTurns.diagnostics().emittedTurns, 0);
  assert.equal(context.inboundTurns.diagnostics().expiryDriver, "NONE", "default OFF starts no expiry driver");
});

test("bootstrap wiring: an explicitly enabled switch aggregates through the composed service", () => {
  const clock = new VirtualClock();
  const turns = [];
  const driver = fakeScheduler();
  const context = createMainContext({
    testMode: true,
    inboundTurnAggregation: {
      enabled: true, quietWindowMs: TURN_QUIET_WINDOW_DEFAULT_MS, clock, scheduler: driver.scheduler, onTurn: (turn) => turns.push(turn),
    },
  });
  assert.equal(context.inboundTurns.enabled, true);
  context.inboundTurns.ingest(request());
  assert.equal(context.inboundTurns.diagnostics().aggregatedMessages, 1);
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  driver.tickNow();
  const emitted = context.inboundTurns.turns();
  assert.equal(emitted.length, 1, "the injected expiry driver produced the turn");
  assert.equal(turns.length, 1, "the Main-owned sink receives the turn");
  assert.equal(emitted[0].automaticProcessingEligible, false);
  assert.equal(context.inboundReceipt.ingested, 0, "no canonical ingestion happened in this unit test");
  assert.equal(context.inboundTurnFailures.failures, 0, "aggregation failures are counted separately from the canonical receipt");
  context.inboundTurns.stop();
});

test("expiry driver: the LAST message of a burst produces a turn with no further message", () => {
  const { clock, builder, driver, turns } = harness();
  builder.ingest(request({ receipt: { messageId: "m-1" }, observedAt: "2026-09-21T00:00:00.000Z", contentText: "你好" }));
  builder.ingest(request({ receipt: { messageId: "m-2" }, observedAt: "2026-09-21T00:00:01.000Z", contentText: "什么时候发货" }));
  assert.equal(driver.counts().started, 1, "the driver starts exactly once when the switch is enabled");
  assert.equal(builder.diagnostics().expiryDriver, "RUNNING");

  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS - 1);
  driver.tickNow();
  assert.equal(turns.length, 0, "a tick before the quiet window elapses emits nothing");
  clock.advance(1);
  driver.tickNow();
  assert.equal(turns.length, 1, "the driver emits the turn without any further message");
  assert.deepEqual(turns[0].source_message_ids, ["m-1", "m-2"]);

  driver.tickNow();
  assert.equal(turns.length, 1, "the window is cleared after emission: no repeated turn");
  assert.equal(builder.turns().length, 1);
  assert.equal(builder.diagnostics().openWindows, 0);
});

test("expiry driver: disabled switch starts NO timer at all", () => {
  const { builder, driver, clock } = harness({ enabled: false });
  assert.deepEqual(driver.counts(), { started: 0, stopped: 0 }, "no timer is ever started when the switch is off");
  assert.equal(builder.diagnostics().expiryDriver, "NONE");
  clock.advance(TURN_QUIET_WINDOW_MAX_MS);
  assert.equal(builder.diagnostics().emittedTurns, 0);
});

test("stop/dispose cancels the driver and no turn can be produced afterwards", () => {
  const { clock, builder, driver, turns } = harness();
  builder.ingest(request({ receipt: { messageId: "m-1" } }));
  builder.stop();
  assert.equal(driver.counts().stopped, 1, "stop() cancels the scheduler");
  assert.equal(builder.diagnostics().expiryDriver, "STOPPED");
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS * 2);
  assert.deepEqual(builder.poll(), [], "poll after stop emits nothing");
  assert.equal(turns.length, 0, "no turn is produced after stop");
  const afterStop = builder.ingest(request({ receipt: { messageId: "m-2" } }));
  assert.equal(afterStop.status, "REFUSED");
  assert.equal(afterStop.reason, "TURN_AGGREGATION_STOPPED");
  assert.equal(builder.diagnostics().openWindows, 0, "stop() clears pending windows");
});

test("a throwing onTurn sink is contained and counted, and never loses the turn", () => {
  const { clock, builder, driver } = harness({
    onTurn: () => { throw new Error("sink down"); },
  });
  builder.ingest(request({ receipt: { messageId: "m-1" } }));
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  driver.tickNow();
  assert.equal(builder.diagnostics().sinkFailures, 1, "the sink failure is counted instead of swallowed");
  assert.equal(builder.turns().length, 1, "the turn is still recorded even though the sink failed");
});

test("the aggregation counters are measured, while the side-effect trio is a labelled structural invariant", () => {
  const { clock, builder, driver } = harness();
  builder.ingest(request({ receipt: { messageId: "m-1" } }));
  builder.ingest(request({ receipt: { status: "DUPLICATE", messageId: "m-1" } }));
  clock.advance(TURN_QUIET_WINDOW_DEFAULT_MS);
  driver.tickNow();
  const diagnostics = builder.diagnostics();
  assert.equal(diagnostics.ingestedReceipts, 1, "measured");
  assert.equal(diagnostics.aggregatedMessages, 1, "measured");
  assert.equal(diagnostics.emittedTurns, 1, "measured");
  assert.equal(diagnostics.droppedDuplicateReceipts, 1, "measured");
  assert.equal(diagnostics.sideEffectGuarantee, "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT");
});
