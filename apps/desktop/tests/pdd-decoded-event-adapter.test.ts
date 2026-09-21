// Adapter regressions: default-off, exception isolation, bounded drain, unload, duplicate
// notifications, generation cross-check, and the no-fallback rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PDD_DECODED_EVENT_OBSERVER_SOURCE, createPddDecodedEventAdapter } from "../dist/main/platforms/pdd/pdd-decoded-inbound-event-adapter.js";

/** Minimal fake page: only the three adapter expressions are understood. */
function makePage(options = {}) {
  const evaluated = [];
  const events = options.events ?? [];
  const page = {
    evaluated,
    installReply: options.installReply ?? { ok: true, storeReachableVia: "root.__vue__.$store" },
    thrown: options.thrown ?? null,
    drained: true,
    generation: null,
    async evaluate(expression) {
      evaluated.push(expression);
      if (page.thrown) throw new Error(page.thrown);
      if (expression === PDD_DECODED_EVENT_OBSERVER_SOURCE) return page.installReply;
      const setGeneration = /setGeneration\((\d+)\)/.exec(expression);
      if (setGeneration) { page.generation = Number(setGeneration[1]); return page.generation; }
      if (expression.includes("__sheep301Adapter.drain")) {
        if (!page.drained) return null;
        const limitMatch = /drain\((\d+)\)/.exec(expression);
        const limit = limitMatch ? Number(limitMatch[1]) : events.length;
        const drained = events.splice(0, limit);
        return { events: drained, remaining: events.length, mutationCounts: { UPDATE_CHAT_LIST_ONE: drained.length }, dropped: page.dropped ?? 0 };
      }
      if (expression.includes("__sheep301Adapter.uninstall")) return { ok: true };
      return null;
    },
  };
  return page;
}

const binding = (generation) => () => ({ sessionId: "pdd-session-shop-1", shopId: "shop-1", documentGeneration: generation });

function messageEvent(overrides = {}) {
  return {
    mutation: "UPDATE_CHAT_LIST_ONE",
    pageDocumentGeneration: 1,
    message: { msg_id: "1789900000001", client_msg_id: null, type: 0, content: "FS-ADAPTER-1", ts: null, is_history: false, from: { role: "user", uid: "2318082461" }, to: { role: "mall_cs", uid: "1000000000003" }, ...overrides },
  };
}

test("the adapter is disabled by default and never touches the page", async () => {
  const page = makePage();
  const adapter = createPddDecodedEventAdapter({ enabled: false, evaluate: page, document: binding(1) });
  const installed = await adapter.install();
  assert.equal(installed.ok, false);
  assert.equal(installed.reason, "ADAPTER_DISABLED");
  assert.equal(adapter.state(), "DISABLED");
  assert.equal(page.evaluated.length, 0, "no page interaction while disabled");
  const drained = await adapter.drain();
  assert.equal(drained.reason, "ADAPTER_DISABLED");
  assert.equal(page.evaluated.length, 0);
});

test("install records the page observer reachability and drain returns structured messages", async () => {
  const page = makePage({ events: [messageEvent()] });
  const adapter = createPddDecodedEventAdapter({ enabled: true, evaluate: page, document: binding(1) });
  const installed = await adapter.install();
  assert.equal(installed.ok, true);
  assert.equal(installed.storeReachableVia, "root.__vue__.$store");
  assert.equal(adapter.state(), "INSTALLED");
  const drained = await adapter.drain();
  assert.equal(drained.ok, true);
  assert.equal(drained.messages.length, 1);
  assert.equal(drained.messages[0].identityAuthority, "PAYLOAD_SUPPLIED_UNVERIFIED", "the page path never claims verified authority");
  assert.equal(drained.messages[0].source, "PAGE_DECODED_EVENT");
  assert.ok(drained.diagnostics.includes("NEWNESS_UNVERIFIED"), "a missing history marker is not evidence of a real-time arrival");
  assert.equal(page.generation, 1, "the Main-held generation is handed to the page for cross-checking only");
});

test("install failure and page exceptions are reported, never thrown, and never fall back", async () => {
  const unreachable = makePage({ installReply: { ok: false, reason: "STORE_UNREACHABLE" } });
  const failed = createPddDecodedEventAdapter({ enabled: true, evaluate: unreachable, document: binding(1) });
  assert.deepEqual(await failed.install(), { ok: false, reason: "STORE_UNREACHABLE" });
  assert.equal(failed.state(), "FAILED");
  assert.equal((await failed.drain()).reason, "ADAPTER_NOT_INSTALLED");
  assert.deepEqual(unreachable.evaluated, [PDD_DECODED_EVENT_OBSERVER_SOURCE], "no alternative (legacy / DOM / nickname) probing");

  const broken = makePage({ thrown: "Page is destroyed" });
  const isolated = createPddDecodedEventAdapter({ enabled: true, evaluate: broken, document: binding(1) });
  const result = await isolated.install();
  assert.equal(result.ok, false);
  assert.equal(result.reason, "PAGE_UNAVAILABLE");
  assert.equal(isolated.state(), "FAILED");
});

test("duplicate notifications are counted but not dropped by the adapter", async () => {
  const page = makePage({ events: [messageEvent(), messageEvent(), messageEvent(), messageEvent({ msg_id: "1789900000002", content: "FS-ADAPTER-2" })] });
  const adapter = createPddDecodedEventAdapter({ enabled: true, evaluate: page, document: binding(1) });
  await adapter.install();
  const drained = await adapter.drain();
  assert.equal(drained.messages.length, 4, "duplicate mapping is allowed here; dedupe belongs to the Main store");
  assert.equal(drained.duplicateNotifications, 2);
});

test("history and real-time entries in the same drain are distinguished only by the page marker", async () => {
  const page = makePage({ events: [messageEvent({ msg_id: "1789900000003", is_history: true }), messageEvent({ msg_id: "1789900000004", is_history: false })] });
  const adapter = createPddDecodedEventAdapter({ enabled: true, evaluate: page, document: binding(1) });
  await adapter.install();
  const drained = await adapter.drain();
  assert.equal(drained.messages.length, 2);
  assert.equal(drained.diagnostics.filter((entry) => entry === "NEWNESS_UNVERIFIED").length, 1, "only the unmarked entry carries the limitation");
});

test("events from another document generation are rejected as identity-bearing input", async () => {
  const page = makePage({ events: [messageEvent({ pageDocumentGeneration: 1 })] });
  const adapter = createPddDecodedEventAdapter({ enabled: true, evaluate: page, document: binding(2) });
  await adapter.install();
  const drained = await adapter.drain();
  assert.equal(drained.messages.length, 0, "a stale page generation cannot borrow the current identity");
  assert.ok(drained.diagnostics.includes("GENERATION_MISMATCH"));
});

test("a single drain is batch-limited while the remainder stays in the page buffer", async () => {
  const events = [];
  for (let index = 0; index < 5; index += 1) events.push(messageEvent({ msg_id: "178990000100" + index }));
  const page = makePage({ events });
  const adapter = createPddDecodedEventAdapter({ enabled: true, evaluate: page, document: binding(1), maxMessagesPerDrain: 2 });
  await adapter.install();
  const first = await adapter.drain();
  assert.equal(first.messages.length, 2);
  assert.ok(first.diagnostics.includes("BATCH_LIMIT_REACHED_REMAINING_3"), "the remainder is reported, not silently lost");
  const second = await adapter.drain();
  assert.equal(second.messages.length, 2);
  assert.ok(second.diagnostics.includes("BATCH_LIMIT_REACHED_REMAINING_1"));
  const third = await adapter.drain();
  assert.equal(third.messages.length, 1, "batching must not lose messages");
  assert.equal(third.diagnostics.some((entry) => entry.startsWith("BATCH_LIMIT_REACHED")), false);
});

test("a real page-side drop is reported as a coverage gap", async () => {
  const page = makePage({ events: [messageEvent({ msg_id: "1789900002001" })] });
  page.dropped = 7;
  const adapter = createPddDecodedEventAdapter({ enabled: true, evaluate: page, document: binding(1) });
  await adapter.install();
  const drained = await adapter.drain();
  assert.equal(drained.dropped, 7);
  assert.ok(drained.diagnostics.includes("PAGE_OBSERVER_DROPPED_7"), "a drop must never look like a healthy complete buffer");
});

test("unload detaches the observer and later drains do not touch the page", async () => {
  const page = makePage({ events: [messageEvent()] });
  const adapter = createPddDecodedEventAdapter({ enabled: true, evaluate: page, document: binding(1) });
  await adapter.install();
  const unloaded = await adapter.unload();
  assert.equal(unloaded.ok, true);
  assert.equal(adapter.state(), "UNLOADED");
  const evaluationsAfterUnload = page.evaluated.length;
  const drained = await adapter.drain();
  assert.equal(drained.reason, "ADAPTER_UNLOADED");
  assert.equal(page.evaluated.length, evaluationsAfterUnload, "no page interaction after unload");
});

test("an unexpected drain shape is reported explicitly", async () => {
  const page = makePage();
  page.drained = false;
  const adapter = createPddDecodedEventAdapter({ enabled: true, evaluate: page, document: binding(1) });
  await adapter.install();
  const drained = await adapter.drain();
  assert.equal(drained.ok, false);
  assert.equal(drained.reason, "DRAIN_SHAPE_INVALID");
});
