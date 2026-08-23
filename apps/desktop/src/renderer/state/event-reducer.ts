// M6 renderer event reducer (pure, clean-room).
// Decides ONLY how to react to a Main-projected event:
//  - ignore stale events (older revision / unselected shop),
//  - refresh the authoritative snapshot on applied events,
//  - request a resync when a revision gap or unknown event is seen.
// It NEVER mutates business state.
import type { OrchestratorEventPayload } from "@fastwork/desktop-ipc";
import { revisionOf, isStaleEvent, type UiState } from "./view-model.js";

export type EventReduceOutcome =
  | { kind: "ignored_stale"; reason: string }
  | { kind: "resync_required"; reason: string };

export function reduceEvent(state: UiState, event: OrchestratorEventPayload): EventReduceOutcome {
  if (isStaleEvent(state, event)) {
    return { kind: "ignored_stale", reason: "stale_or_unselected" };
  }
  const current = revisionOf(state.viewModel);
  // Events carry a monotonic revision. A jump of more than one indicates we
  // missed intermediate state: reload the authoritative snapshot from Main.
  if (current !== 0 && event.revision > current + 1) {
    return { kind: "resync_required", reason: "revision_gap" };
  }
  return { kind: "resync_required", reason: "event_applied" };
}

export function shouldResync(outcome: EventReduceOutcome): boolean {
  return outcome.kind === "resync_required";
}
