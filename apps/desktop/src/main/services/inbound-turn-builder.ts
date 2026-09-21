// SHEEP-303 Inbound Aggregation / Turn Builder (in-memory only).
//
// Purpose: aggregate consecutive inbound customer messages inside ONE identity scope and emit ONE
// in-memory turn after a quiet window, so the later scene/plan/policy stages see one complete question
// set instead of fragmented single messages.
//
// Boundaries (SHEEP-303 allowed scope):
// - IN-MEMORY ONLY: no persistence, no canonical schema change, no AI call, no send, no order or
//   delivery mutation, no scene classification, no fact extraction, no reply generation.
// - The ONLY trigger is the canonical persistence receipt `INGESTED` (a message identity that was
//   durably stored for this scope for the first time). "First seen", "first stored", a missing
//   `is_history` marker or an in-memory restart marker are NEVER treated as a new question.
// - `observedAt` is the trusted Main ingestion time used ONLY for window timing and ordering. It is
//   never presented as the platform business occurrence time (source time keeps its existing null
//   semantics).
// - Aggregation never crosses platform / merchant / store / platform account / conversation / customer.
//   Incomplete or conflicting scope fails closed with an explicit reason.
// - Every emitted turn is `newness = NEWNESS_UNVERIFIED` and `automaticProcessingEligible = false`:
//   an aggregated turn is a candidate artifact, never a reply obligation.

/** Quiet window target from the product contract: approximately 3-5 seconds. */
export const TURN_QUIET_WINDOW_MIN_MS = 3000;
export const TURN_QUIET_WINDOW_MAX_MS = 5000;
export const TURN_QUIET_WINDOW_DEFAULT_MS = 4000;

/** Millisecond clock port. Production passes an epoch clock; tests pass `VirtualClock`. */
export interface TurnAggregationClock {
  now(): number;
}

/**
 * Expiry driver port. The builder never relies on the caller remembering to poll: when the switch is
 * enabled it starts ONE scheduler whose tick evaluates expired windows, so the LAST message of a
 * burst still produces a turn without any further message arriving.
 *
 * The default implementation is a bounded interval scheduler owned by Main; tests inject a fake
 * scheduler or drive it from `VirtualClock` (no real sleeps).
 */
export interface TurnExpiryScheduler {
  start(onTick: () => void): void;
  stop(): void;
}

/** Tick interval of the default Main-owned scheduler (bounded well below the 3-5s window). */
export const TURN_EXPIRY_TICK_DEFAULT_MS = 250;

export function createIntervalExpiryScheduler(tickMs: number = TURN_EXPIRY_TICK_DEFAULT_MS): TurnExpiryScheduler {
  let handle: ReturnType<typeof setInterval> | null = null;
  return {
    start(onTick: () => void) {
      if (handle !== null) return;
      handle = setInterval(onTick, Math.max(50, Math.floor(tickMs)));
      // The aggregation tick must never keep the process alive on its own.
      (handle as unknown as { unref?: () => void }).unref?.();
    },
    stop() {
      if (handle === null) return;
      clearInterval(handle);
      handle = null;
    },
  };
}

export interface InboundTurnScope {
  readonly merchantId: string | null;
  readonly storeId: string | null;
  readonly platformAccountId: string | null;
}

/** Canonical persistence receipt (only `INGESTED` aggregates). */
export interface InboundTurnReceipt {
  readonly status: "INGESTED" | "DUPLICATE";
  readonly conversationId: string;
  readonly messageId: string;
}

export interface InboundTurnIngestRequest {
  readonly receipt: InboundTurnReceipt;
  readonly platform: string | null;
  readonly scope: InboundTurnScope;
  readonly customerId: string | null;
  readonly observedAt: string | null;
  readonly actor: string | null;
  readonly contentKind: string | null;
  readonly contentText: string | null;
}

export interface InboundTurnIdentityLock {
  readonly platform: string;
  readonly merchantId: string;
  readonly storeId: string;
  readonly platformAccountId: string;
  readonly conversationId: string;
  readonly customerId: string | null;
}

export interface InboundTurn {
  readonly turn_id: string;
  readonly identity_lock: InboundTurnIdentityLock;
  readonly source_message_ids: readonly string[];
  /** Ordering evidence for the aggregated messages (Main ingestion time, never the business time). */
  readonly source_observed_at: readonly (string | null)[];
  readonly created_at: string;
  readonly newness: "NEWNESS_UNVERIFIED";
  readonly automaticProcessingEligible: false;
}

export type InboundTurnRefusalReason =
  | "NOT_INGESTED_RECEIPT"
  | "TURN_AGGREGATION_DISABLED"
  | "TURN_AGGREGATION_STOPPED"
  | "SCOPE_INCOMPLETE"
  | "OBSERVED_AT_UNKNOWN"
  | "NON_CUSTOMER_ACTOR"
  | "NON_TEXT_CONTENT"
  | "CONTENT_MISSING"
  | "IDENTITY_WINDOW_CONFLICT"
  | "DUPLICATE_MESSAGE_ID";

export type InboundTurnIngestOutcome =
  | { readonly status: "AGGREGATED"; readonly reason: null; readonly windowSize: number }
  | { readonly status: "DROPPED"; readonly reason: "NOT_INGESTED_RECEIPT"; readonly windowSize: number }
  | { readonly status: "REFUSED"; readonly reason: InboundTurnRefusalReason; readonly windowSize: number };

export interface InboundTurnDiagnostics {
  readonly enabled: boolean;
  readonly quietWindowMs: number;
  readonly ingestedReceipts: number;
  readonly aggregatedMessages: number;
  readonly emittedTurns: number;
  readonly openWindows: number;
  readonly droppedDuplicateReceipts: number;
  readonly refusedByReason: Readonly<Record<string, number>>;
  /** Expiry driver state: NONE = disabled (no timer was ever started). */
  readonly expiryDriver: "NONE" | "RUNNING" | "STOPPED";
  /** Turn-sink exceptions contained by the builder (the sink can never break aggregation). */
  readonly sinkFailures: number;
  /**
   * These three are STRUCTURAL INVARIANTS of this module, not runtime measurements: the builder
   * exposes no AI, send or persistence port at all. A measurement would have to happen at the
   * composition boundary (see `sideEffectGuarantee`).
   */
  readonly aiCalls: 0;
  readonly sendCalls: 0;
  readonly productionWrites: 0;
  readonly sideEffectGuarantee: "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT";
}

export interface InboundTurnBuilder {
  readonly enabled: boolean;
  ingest(request: InboundTurnIngestRequest): InboundTurnIngestOutcome;
  /**
   * Evaluate the quiet window; expired windows emit their turn. Called by the expiry driver on every
   * tick, and available directly for tests/diagnostics. `nowMs` defaults to the injected clock.
   */
  poll(nowMs?: number): readonly InboundTurn[];
  /** Stop/dispose: cancels the expiry driver and makes further aggregation impossible. */
  stop(): void;
  /** Emitted turns, oldest first (in-memory sink). */
  turns(): readonly InboundTurn[];
  diagnostics(): InboundTurnDiagnostics;
}

interface WindowMessage {
  readonly messageId: string;
  readonly observedAt: string | null;
  /**
   * Receipt arrival order inside this window. It is the secondary ordering key: `observedAt` has
   * millisecond resolution, so several messages of one burst can share a timestamp - ordering those
   * by a derived id would scramble the customer's question order.
   */
  readonly ordinal: number;
}

interface TurnWindow {
  readonly key: string;
  readonly identity: InboundTurnIdentityLock;
  messages: WindowMessage[];
  deadlineMs: number;
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function clampQuietWindow(quietWindowMs: number | undefined): number {
  const value = typeof quietWindowMs === "number" && Number.isFinite(quietWindowMs) ? quietWindowMs : TURN_QUIET_WINDOW_DEFAULT_MS;
  return Math.min(TURN_QUIET_WINDOW_MAX_MS, Math.max(TURN_QUIET_WINDOW_MIN_MS, Math.floor(value)));
}

/**
 * Stable ordering: `observedAt` first (nulls last), then the RECEIPT ARRIVAL ORDER of the window.
 * Arrival order is the strongest ordering evidence the aggregation layer owns: it is the order in
 * which canonical persistence accepted these messages. A derived id is only the last-resort
 * tie-break, never the primary one.
 */
function compareMessages(left: WindowMessage, right: WindowMessage): number {
  if (left.observedAt === null && right.observedAt !== null) return 1;
  if (left.observedAt !== null && right.observedAt === null) return -1;
  if (left.observedAt !== null && right.observedAt !== null && left.observedAt !== right.observedAt) {
    return left.observedAt < right.observedAt ? -1 : 1;
  }
  if (left.ordinal !== right.ordinal) return left.ordinal - right.ordinal;
  if (left.messageId === right.messageId) return 0;
  return left.messageId < right.messageId ? -1 : 1;
}

/**
 * Create the in-memory turn builder. `enabled === false` makes the whole builder inert: nothing is
 * aggregated and no turn can ever be emitted (default OFF, production path unchanged).
 */
export function createInboundTurnBuilder(options: {
  readonly enabled: boolean;
  readonly quietWindowMs?: number;
  readonly clock?: TurnAggregationClock;
  readonly onTurn?: (turn: InboundTurn) => void;
  /** Expiry driver; only started when the switch is enabled. Defaults to the Main interval scheduler. */
  readonly scheduler?: TurnExpiryScheduler;
}): InboundTurnBuilder {
  const enabled = options.enabled === true;
  const quietWindowMs = clampQuietWindow(options.quietWindowMs);
  const clock: TurnAggregationClock = options.clock ?? { now: () => Date.now() };
  const onTurn = options.onTurn ?? (() => undefined);
  const scheduler: TurnExpiryScheduler = options.scheduler ?? createIntervalExpiryScheduler();
  let stopped = false;
  let driverState: "NONE" | "RUNNING" | "STOPPED" = "NONE";
  const windows = new Map<string, TurnWindow>();
  const emitted: InboundTurn[] = [];
  const counters = { ingestedReceipts: 0, aggregatedMessages: 0, emittedTurns: 0, droppedDuplicateReceipts: 0, sinkFailures: 0 };
  const refusedByReason: Record<string, number> = {};
  let turnSequence = 0;

  const refuse = (reason: InboundTurnRefusalReason, windowSize: number): InboundTurnIngestOutcome => {
    refusedByReason[reason] = (refusedByReason[reason] ?? 0) + 1;
    return { status: "REFUSED", reason, windowSize };
  };

  function emitExpired(nowMs: number): readonly InboundTurn[] {
    const emittedNow: InboundTurn[] = [];
    for (const [key, window] of [...windows.entries()]) {
      if (window.deadlineMs > nowMs) continue;
      windows.delete(key);
      const ordered = [...window.messages].sort(compareMessages);
      turnSequence += 1;
      const turn: InboundTurn = Object.freeze({
        turn_id: "turn-" + window.identity.platform + "-" + String(turnSequence).padStart(6, "0"),
        identity_lock: Object.freeze({ ...window.identity }),
        source_message_ids: Object.freeze(ordered.map((message) => message.messageId)),
        source_observed_at: Object.freeze(ordered.map((message) => message.observedAt)),
        created_at: new Date(nowMs).toISOString(),
        newness: "NEWNESS_UNVERIFIED" as const,
        automaticProcessingEligible: false as const,
      });
      emitted.push(turn);
      counters.emittedTurns += 1;
      emittedNow.push(turn);
      try { onTurn(turn); } catch { counters.sinkFailures += 1; }
    }
    return emittedNow;
  }

  if (enabled) {
    // Main-owned expiry driver: started here, cancelled by stop(). Without it the last message of a
    // burst would never expire, because nothing else would ever call poll().
    driverState = "RUNNING";
    scheduler.start(() => { if (!stopped) poll(); });
  }

  function poll(nowMs?: number): readonly InboundTurn[] {
    if (!enabled || stopped) return [];
    return emitExpired(nowMs ?? clock.now());
  }

  return {
    enabled,

    ingest(request: InboundTurnIngestRequest): InboundTurnIngestOutcome {
      if (stopped) return refuse("TURN_AGGREGATION_STOPPED", 0);
      // Expiry is evaluated on the injected clock before accepting anything new (idempotent with the
      // expiry driver, and correct even when no driver is injected).
      if (enabled) emitExpired(clock.now());
      if (!enabled) {
        return refuse("TURN_AGGREGATION_DISABLED", 0);
      }

      const receipt = request.receipt;
      if (receipt.status === "DUPLICATE") {
        counters.droppedDuplicateReceipts += 1;
        return { status: "DROPPED", reason: "NOT_INGESTED_RECEIPT", windowSize: 0 };
      }
      counters.ingestedReceipts += 1;

      const platform = cleanString(request.platform);
      const merchantId = cleanString(request.scope.merchantId);
      const storeId = cleanString(request.scope.storeId);
      const platformAccountId = cleanString(request.scope.platformAccountId);
      const conversationId = cleanString(receipt.conversationId);
      const messageId = cleanString(receipt.messageId);
      if (platform === null || merchantId === null || storeId === null || platformAccountId === null || conversationId === null || messageId === null) {
        return refuse("SCOPE_INCOMPLETE", 0);
      }
      const observedAt = cleanString(request.observedAt);
      if (observedAt === null) return refuse("OBSERVED_AT_UNKNOWN", 0);
      if (request.actor !== "customer") return refuse("NON_CUSTOMER_ACTOR", 0);
      if (request.contentKind !== "text") return refuse("NON_TEXT_CONTENT", 0);
      if (cleanString(request.contentText) === null) return refuse("CONTENT_MISSING", 0);
      const customerId = cleanString(request.customerId);

      const key = [platform, merchantId, storeId, platformAccountId, conversationId, customerId ?? "<unknown>"].join("\u0000");
      // One conversation must keep ONE stable identity inside a window: if the same conversation is
      // seen with a changed identity/scope (different aggregation key), the new message is refused
      // and never merged into the pending window.
      for (const window of windows.values()) {
        if (window.identity.conversationId === conversationId && window.key !== key) {
          return refuse("IDENTITY_WINDOW_CONFLICT", window.messages.length);
        }
      }

      const existing = windows.get(key);
      if (existing) {
        if (existing.messages.some((message) => message.messageId === messageId)) return refuse("DUPLICATE_MESSAGE_ID", existing.messages.length);
        existing.messages.push({ messageId, observedAt, ordinal: existing.messages.length });
        existing.deadlineMs = clock.now() + quietWindowMs;
        counters.aggregatedMessages += 1;
        return { status: "AGGREGATED", reason: null, windowSize: existing.messages.length };
      }

      const identity: InboundTurnIdentityLock = Object.freeze({
        platform, merchantId, storeId, platformAccountId, conversationId, customerId,
      });
      windows.set(key, { key, identity, messages: [{ messageId, observedAt, ordinal: 0 }], deadlineMs: clock.now() + quietWindowMs });
      counters.aggregatedMessages += 1;
      return { status: "AGGREGATED", reason: null, windowSize: 1 };
    },

    poll,

    stop(): void {
      if (stopped) return;
      stopped = true;
      try { scheduler.stop(); } catch { /* driver already gone */ }
      if (driverState === "RUNNING") driverState = "STOPPED";
      windows.clear();
    },

    turns(): readonly InboundTurn[] {
      return emitted.map((turn) => turn);
    },

    diagnostics(): InboundTurnDiagnostics {
      return {
        enabled,
        quietWindowMs,
        ingestedReceipts: counters.ingestedReceipts,
        aggregatedMessages: counters.aggregatedMessages,
        emittedTurns: counters.emittedTurns,
        openWindows: windows.size,
        droppedDuplicateReceipts: counters.droppedDuplicateReceipts,
        refusedByReason: { ...refusedByReason },
        expiryDriver: driverState,
        sinkFailures: counters.sinkFailures,
        aiCalls: 0,
        sendCalls: 0,
        productionWrites: 0,
        sideEffectGuarantee: "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT",
      };
    },
  };
}
