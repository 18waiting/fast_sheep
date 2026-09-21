// SHEEP-301 controlled decoded-event-capture entry (version-managed, DEFAULT OFF).
//
// The application composition (bootstrap) only TRANSPORTS the Main-owned switch
// (`decodedEventCapture`) and exposes the service methods. This module is the single controlled
// ENTRY that owns the call ORDER for one shop (start -> drain* -> stop), so no caller has to
// re-implement the lifecycle, and no caller can accidentally drain an un-started capture.
//
// Properties kept on purpose:
// - DEFAULT OFF: unless Main explicitly enables it, every call is refused and the platform service
//   is never touched (the platform call counters stay at zero).
// - The entry never enables anything itself: it drives the already-composed
//   PddPlatformService through its controlled methods only. Identity, admission, mapping,
//   validation and persistence stay where they already are (Main).
// - The lifecycle is once-per-entry: start -> RUNNING -> stop -> STOPPED. A stopped capture is
//   never silently restarted; a new observation is a NEW entry (new explicit Main decision).
// - Failures are reported as reasons, never retried, and never fall back to another path.

export interface ControlledDecodedEventCaptureDrain {
  readonly ok: boolean;
  readonly reason?: string;
  readonly drained: number;
  readonly ingested: number;
  readonly duplicates: number;
  readonly remaining: number;
  readonly dropped: number;
  readonly gap: boolean;
  readonly diagnostics: readonly string[];
}

/** The controlled methods of the already-composed platform service (structural port). */
export interface ControlledDecodedEventCapturePort {
  startDecodedEventCapture(shopId: string): Promise<{ ok: boolean; reason?: string }>;
  drainDecodedEvents(shopId: string): Promise<ControlledDecodedEventCaptureDrain>;
  stopDecodedEventCapture(shopId: string): Promise<{ ok: boolean; reason?: string }>;
}

export type ControlledCaptureStage = "start" | "drain" | "stop";

export type ControlledCaptureState = "NOT_STARTED" | "RUNNING" | "STOPPED" | "FAILED";

export interface ControlledCaptureRefusal {
  readonly stage: ControlledCaptureStage;
  readonly reason: string;
}

export interface ControlledCaptureStepResult {
  readonly ok: boolean;
  readonly reason: string;
}

export interface ControlledCaptureSummary {
  readonly enabled: boolean;
  readonly shopId: string;
  readonly state: ControlledCaptureState;
  readonly startCalls: number;
  readonly drainCalls: number;
  readonly stopCalls: number;
  readonly drained: number;
  readonly ingested: number;
  readonly duplicates: number;
  readonly refusals: readonly ControlledCaptureRefusal[];
}

export interface ControlledDecodedEventCaptureEntry {
  readonly shopId: string;
  state(): ControlledCaptureState;
  start(): Promise<ControlledCaptureStepResult>;
  drain(): Promise<ControlledDecodedEventCaptureDrain>;
  stop(): Promise<ControlledCaptureStepResult>;
  summary(): ControlledCaptureSummary;
}

export const CONTROLLED_CAPTURE_DISABLED = "CONTROLLED_CAPTURE_DISABLED";
export const CONTROLLED_CAPTURE_NOT_STARTED = "CONTROLLED_CAPTURE_NOT_STARTED";
export const CONTROLLED_CAPTURE_NOT_RUNNING = "CONTROLLED_CAPTURE_NOT_RUNNING";
export const CONTROLLED_CAPTURE_ALREADY_RUNNING = "CONTROLLED_CAPTURE_ALREADY_RUNNING";
export const CONTROLLED_CAPTURE_STOPPED = "CONTROLLED_CAPTURE_STOPPED";
export const CONTROLLED_CAPTURE_START_FAILED = "CONTROLLED_CAPTURE_START_FAILED";

function emptyDrain(reason: string): ControlledDecodedEventCaptureDrain {
  return {
    ok: false, reason,
    drained: 0, ingested: 0, duplicates: 0, remaining: 0, dropped: 0, gap: false, diagnostics: [],
  };
}

/**
 * Create the controlled capture entry for ONE shop.
 * `enabled` is a Main-owned decision: false (the default) makes the whole entry inert.
 */
export function createControlledDecodedEventCaptureEntry(options: {
  readonly enabled: boolean;
  readonly shopId: string;
  readonly platform: ControlledDecodedEventCapturePort;
}): ControlledDecodedEventCaptureEntry {
  const enabled = options.enabled === true;
  const shopId = options.shopId;
  const platform = options.platform;
  let state: ControlledCaptureState = "NOT_STARTED";
  const counters = { startCalls: 0, drainCalls: 0, stopCalls: 0, drained: 0, ingested: 0, duplicates: 0 };
  const refusals: ControlledCaptureRefusal[] = [];

  function refuse(stage: ControlledCaptureStage, reason: string): ControlledCaptureStepResult {
    refusals.push({ stage, reason });
    return { ok: false, reason };
  }

  return {
    shopId,
    state: () => state,

    async start(): Promise<ControlledCaptureStepResult> {
      if (!enabled) return refuse("start", CONTROLLED_CAPTURE_DISABLED);
      if (state === "RUNNING") return refuse("start", CONTROLLED_CAPTURE_ALREADY_RUNNING);
      if (state === "STOPPED" || state === "FAILED") return refuse("start", CONTROLLED_CAPTURE_STOPPED);
      counters.startCalls += 1;
      const result = await platform.startDecodedEventCapture(shopId);
      if (result.ok !== true) {
        state = "FAILED";
        return refuse("start", result.reason ?? CONTROLLED_CAPTURE_START_FAILED);
      }
      state = "RUNNING";
      return { ok: true, reason: "STARTED" };
    },

    async drain(): Promise<ControlledDecodedEventCaptureDrain> {
      if (!enabled) {
        refuse("drain", CONTROLLED_CAPTURE_DISABLED);
        return emptyDrain(CONTROLLED_CAPTURE_DISABLED);
      }
      if (state === "NOT_STARTED") {
        refuse("drain", CONTROLLED_CAPTURE_NOT_STARTED);
        return emptyDrain(CONTROLLED_CAPTURE_NOT_STARTED);
      }
      if (state !== "RUNNING") {
        refuse("drain", CONTROLLED_CAPTURE_NOT_RUNNING);
        return emptyDrain(CONTROLLED_CAPTURE_NOT_RUNNING);
      }
      counters.drainCalls += 1;
      const result = await platform.drainDecodedEvents(shopId);
      if (result.ok !== true) {
        // A refused batch is reported as-is: it is never retried and never replayed.
        refuse("drain", result.reason ?? "DRAIN_FAILED");
        return result;
      }
      counters.drained += result.drained;
      counters.ingested += result.ingested;
      counters.duplicates += result.duplicates;
      return result;
    },

    async stop(): Promise<ControlledCaptureStepResult> {
      if (!enabled) return refuse("stop", CONTROLLED_CAPTURE_DISABLED);
      if (state !== "RUNNING") return refuse("stop", CONTROLLED_CAPTURE_NOT_RUNNING);
      counters.stopCalls += 1;
      const result = await platform.stopDecodedEventCapture(shopId);
      state = "STOPPED";
      if (result.ok !== true) return refuse("stop", result.reason ?? "STOP_FAILED");
      return { ok: true, reason: "STOPPED" };
    },

    summary(): ControlledCaptureSummary {
      return {
        enabled,
        shopId,
        state,
        startCalls: counters.startCalls,
        drainCalls: counters.drainCalls,
        stopCalls: counters.stopCalls,
        drained: counters.drained,
        ingested: counters.ingested,
        duplicates: counters.duplicates,
        refusals: refusals.map((entry) => ({ ...entry })),
      };
    },
  };
}
