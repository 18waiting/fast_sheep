import { test } from "node:test";
import assert from "node:assert/strict";
import { reduceEvent, shouldResync } from "../dist/renderer/state/event-reducer.js";
import { EMPTY_UI_STATE, type UiState } from "../dist/renderer/state/view-model.js";
import type { WorkbenchViewModel } from "@fastwork/desktop-ipc";

function stateWithRevision(revision: number, selectedShopId: string | null = "s1"): UiState {
  const vm: WorkbenchViewModel = {
    revision,
    shop_summaries: [],
    worker_status: { status: "ready" },
    platform_capability: "none",
  };
  return { ...EMPTY_UI_STATE, viewModel: vm, selectedShopId };
}

test("stale event (older revision) is ignored and never overwrites newer projection", () => {
  const s = stateWithRevision(5);
  const out = reduceEvent(s, { event: "SendStarted", revision: 4 });
  assert.equal(out.kind, "ignored_stale");
  assert.equal(shouldResync(out), false);
});

test("event for an unselected shop is ignored (shop isolation)", () => {
  const s = stateWithRevision(5, "s1");
  const out = reduceEvent(s, { event: "SuggestionReady", revision: 6, shop_id: "s2" });
  assert.equal(out.kind, "ignored_stale");
});

test("revision gap forces authoritative resync", () => {
  const s = stateWithRevision(5);
  const out = reduceEvent(s, { event: "SendCompleted", revision: 9 });
  assert.equal(out.kind, "resync_required");
  assert.equal(out.reason, "revision_gap");
});

test("normal applied event triggers snapshot refresh, not local business decision", () => {
  const s = stateWithRevision(5);
  const out = reduceEvent(s, { event: "SuggestionReady", revision: 6 });
  assert.equal(out.kind, "resync_required");
  assert.equal(out.reason, "event_applied");
});

test("unknown event still triggers resync (never guesses business state)", () => {
  const s = stateWithRevision(5);
  const out = reduceEvent(s, { event: "UnknownEventXYZ", revision: 6 });
  assert.equal(out.kind, "resync_required");
});
