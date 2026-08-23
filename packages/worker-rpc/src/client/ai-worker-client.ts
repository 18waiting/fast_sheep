// Clean-room implementation (TASK-017 M2). Main-side AI worker client (stdio JSONL v1).
import { randomUUID } from "node:crypto";
import {
  READY_EVENT,
  RPC_PROTOCOL_VERSION,
  DEFAULT_MAX_FRAME_BYTES,
  DEFAULT_MAX_INFLIGHT,
  DEFAULT_STARTUP_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
} from "../protocol/constants.js";
import { RpcError, RPC_ERROR_CODES } from "../protocol/errors.js";
import { assertValidReadyPayload, validateResponse, validateWorkerReadyPayload } from "../protocol/validation.js";
import type { CancelResult, HealthResult, RequestOptions, RpcEvent, RpcRequest, RpcResponse, WorkerSpawn } from "../protocol/types.js";
import { PendingRequestRegistry } from "./pending-request-registry.js";
import { WriteQueue } from "./write-queue.js";
import { WorkerProcess } from "./worker-process.js";
import { RestartPolicy, type RestartPolicyConfig, DEFAULT_RESTART_POLICY } from "./restart-policy.js";
import type { ClientState } from "./client-state.js";

export interface AIWorkerClientOptions {
  spawn: WorkerSpawn;
  env?: Record<string, string>;
  maxFrameBytes?: number;
  maxInFlight?: number;
  maxQueuedFrames?: number;
  startupTimeoutMs?: number;
  requestTimeoutMs?: number;
  gracefulShutdownTimeoutMs?: number;
  restart?: Partial<RestartPolicyConfig>;
  /** Injectable sleep for deterministic tests (fake timers). */
  sleepMs?: (ms: number) => Promise<void>;
  /** Injectable request-id factory for deterministic tests. */
  requestIdFactory?: () => string;
  /** Injectable correlation-id factory. */
  correlationIdFactory?: () => string;
}

export interface WorkerEvent {
  event: string;
  payload: Record<string, unknown>;
  correlation_id?: string;
}

type EventSubscriber = (ev: WorkerEvent) => void;

const sleepDefault = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * M2 AI worker client. Public infrastructure API only:
 * start/stop/health/request/cancelRequest/subscribeEvents/state.
 * No domain façades (generateReply/queryKnowledge/runReview) — those are M3+.
 */
export class AIWorkerClient {
  private readonly options: Required<Pick<AIWorkerClientOptions, "maxFrameBytes" | "maxInFlight" | "startupTimeoutMs" | "requestTimeoutMs" | "gracefulShutdownTimeoutMs">> &
    AIWorkerClientOptions;
  private readonly pending = new PendingRequestRegistry();
  private readonly restartPolicy: RestartPolicy;
  private readonly subscribers = new Set<EventSubscriber>();
  private process: WorkerProcess | null = null;
  private writeQueue: WriteQueue | null = null;
  private stateValue: ClientState = "STOPPED";
  private readyPayload: { worker_version: string; protocol_versions: number[]; pid: number; python_version: string; capabilities: string[] } | null = null;
  private intentionalStop = false;
  private startedAt = 0;
  private readyPromise: Promise<void> | null = null;

  constructor(opts: AIWorkerClientOptions) {
    this.options = {
      ...opts,
      maxFrameBytes: opts.maxFrameBytes ?? DEFAULT_MAX_FRAME_BYTES,
      maxInFlight: opts.maxInFlight ?? DEFAULT_MAX_INFLIGHT,
      maxQueuedFrames: opts.maxQueuedFrames ?? opts.maxInFlight ?? DEFAULT_MAX_INFLIGHT,
      startupTimeoutMs: opts.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS,
      requestTimeoutMs: opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      gracefulShutdownTimeoutMs: opts.gracefulShutdownTimeoutMs ?? DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
    };
    this.restartPolicy = new RestartPolicy({ ...DEFAULT_RESTART_POLICY, ...(opts.restart ?? {}) });
  }

  state(): ClientState {
    return this.stateValue;
  }

  get protocolVersion(): number {
    return RPC_PROTOCOL_VERSION;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  /** Start the worker, wait for the ready handshake, negotiate version, become READY. */
  async start(): Promise<void> {
    if (this.stateValue === "READY") return;
    if (this.stateValue === "STARTING" && this.readyPromise) {
      return this.readyPromise;
    }
    this.intentionalStop = false;
    await this.spawnAndHandshake(this.options.startupTimeoutMs);
  }

  private async spawnAndHandshake(startupTimeoutMs: number): Promise<void> {
    this.setState("STARTING");
    this.readyPromise = this.doHandshake(startupTimeoutMs);
    await this.readyPromise;
  }

  private async doHandshake(startupTimeoutMs: number): Promise<void> {
    this.readyPayload = null;
    this.startedAt = Date.now();

    const handshake = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new RpcError(RPC_ERROR_CODES.STARTUP_TIMEOUT));
      }, startupTimeoutMs);

      const onReady = (payload: unknown) => {
        try {
          assertValidReadyPayload(payload);
          const versions = payload.protocol_versions;
          if (!versions.includes(RPC_PROTOCOL_VERSION)) {
            reject(new RpcError(RPC_ERROR_CODES.VERSION_UNSUPPORTED, `worker protocol versions ${JSON.stringify(versions)} do not include ${RPC_PROTOCOL_VERSION}`));
            return;
          }
          this.readyPayload = payload;
          clearTimeout(timer);
          resolve();
        } catch (e) {
          clearTimeout(timer);
          reject(e instanceof RpcError ? e : new RpcError(RPC_ERROR_CODES.PROTOCOL_ERROR, String(e)));
        }
      };

      this.readyHandler = (ev: WorkerEvent) => {
        if (ev.event === READY_EVENT) onReady(ev.payload);
      };
    });

    this.spawnWorker();
    try {
      await handshake;
    } catch (e) {
      this.killWorker();
      this.setState("STOPPED");
      this.readyHandler = null;
      throw e;
    }
    this.restartPolicy.reset();
    this.setState("READY");
  }

  private readyHandler: ((ev: WorkerEvent) => void) | null = null;

  private spawnWorker(): void {
    this.process = new WorkerProcess(this.options.spawn, {
      maxFrameBytes: this.options.maxFrameBytes,
      env: this.options.env,
      onFrame: (frame) => this.handleFrame(frame),
      onProtocolIssue: (issue) => {
        // Malformed/oversize frames from the worker are diagnostics only here (client side).
      },
      onStderr: (line) => {
        // Worker diagnostics are stderr-only; not protocol frames.
      },
      onExit: (code, signal) => this.handleExit(code, signal),
    });
    this.process.start();
    this.writeQueue = new WriteQueue(this.process.stdin as NodeJS.WritableStream, {
      maxQueuedFrames: this.options.maxQueuedFrames,
    });
  }

  private handleFrame(frame: unknown): void {
    if (frame === null || typeof frame !== "object") return;
    const obj = frame as Record<string, unknown>;
    if (typeof obj.event === "string") {
      const ev = obj as unknown as WorkerEvent;
      if (this.readyHandler) this.readyHandler(ev);
      this.dispatchEvent(ev);
      return;
    }
    if (typeof obj.request_id === "string" && typeof obj.ok === "boolean") {
      const res = obj as unknown as RpcResponse;
      if (!validateResponse(res).ok) return; // ignore invalid response envelopes
      this.settleResponse(res);
      return;
    }
    // Unknown frame shape: ignore (protocol anomaly).
  }

  private settleResponse(res: RpcResponse): void {
    this.pending.settle(res.request_id, (entry) => {
      if (res.ok) {
        entry.resolve(res.result as never);
      } else {
        entry.reject(new RpcError(res.error?.code ?? RPC_ERROR_CODES.PROTOCOL_ERROR, res.error?.message, {
          category: (res.error?.category as never) ?? undefined,
          retryable: res.error?.retryable,
          details: res.error?.details,
          correlationId: res.error?.correlation_id,
        }));
      }
    });
  }

  private dispatchEvent(ev: WorkerEvent): void {
    for (const sub of [...this.subscribers]) {
      try {
        sub(ev);
      } catch {
        // One bad subscriber must not break the transport.
      }
    }
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    const crashed = !this.intentionalStop;
    this.writeQueue = null;
    if (crashed) {
      this.setState("CRASHED");
      this.pending.failAll(new RpcError(RPC_ERROR_CODES.WORKER_CRASHED));
      void this.maybeRestart();
    } else {
      this.setState("STOPPED");
      this.pending.failAll(new RpcError(RPC_ERROR_CODES.SHUTDOWN));
    }
  }

  private async maybeRestart(): Promise<void> {
    if (this.intentionalStop) return;
    const delay = this.restartPolicy.nextDelayMs();
    if (delay === null) return; // attempts exhausted; stay CRASHED
    this.setState("RESTARTING");
    const sleep = this.options.sleepMs ?? sleepDefault;
    await sleep(delay);
    if (this.intentionalStop) return;
    try {
      await this.spawnAndHandshake(this.options.startupTimeoutMs);
    } catch {
      // restart attempt failed; handleExit on the new process will drive further retries
    }
  }

  /**
   * Send a request. Rejects locally on timeout/cancel; sends system.cancel best-effort
   * when the worker is still alive. Late responses cannot resurrect a settled request.
   */
  async request<T = unknown>(method: string, payload: Record<string, unknown>, options: RequestOptions = {}): Promise<T> {
    const state = this.stateValue;
    if (state === "STOPPING" || state === "STOPPED") {
      throw new RpcError(RPC_ERROR_CODES.SHUTDOWN);
    }
    if (state !== "READY") {
      throw new RpcError(RPC_ERROR_CODES.NOT_READY);
    }
    return this.rawRequest<T>(method, payload, options);
  }

  /** Internal send path used by request() and by stop() for system.shutdown (state-agnostic). */
  private async rawRequest<T = unknown>(method: string, payload: Record<string, unknown>, options: RequestOptions = {}): Promise<T> {
    if (!this.writeQueue || !this.process) {
      throw new RpcError(RPC_ERROR_CODES.NOT_READY);
    }
    const isControl = method.startsWith("system.");
    if (!isControl && this.pending.size >= this.options.maxInFlight) {
      throw new RpcError(RPC_ERROR_CODES.BACKPRESSURE);
    }

    if (options.signal?.aborted) {
      throw new RpcError(RPC_ERROR_CODES.CANCELLED);
    }
    const requestId = this.options.requestIdFactory ? this.options.requestIdFactory() : randomUUID();
    const correlationId = options.context?.correlation_id ?? (this.options.correlationIdFactory ? this.options.correlationIdFactory() : randomUUID());
    const req: RpcRequest = {
      version: RPC_PROTOCOL_VERSION,
      request_id: requestId,
      method,
      payload,
      context: {
        shop_id: options.context?.shop_id ?? "",
        correlation_id: correlationId,
        cancellation_token: options.context?.cancellation_token,
      },
    };

    let frame: string;
    try {
      frame = this.process.writeFrame(req);
    } catch (e) {
      throw e instanceof RpcError ? e : new RpcError(RPC_ERROR_CODES.PROTOCOL_ERROR, String(e));
    }

    const timeoutMs = options.timeoutMs ?? this.options.requestTimeoutMs;
    const registered = this.pending.register<T>(requestId, method, {
      timeoutMs,
      signal: options.signal,
      onTimeout: (rid) => this.notifyCancel(rid),
      onAbort: (rid) => this.notifyCancel(rid),
    });
    if (!registered.ok) {
      throw new RpcError(RPC_ERROR_CODES.PROTOCOL_ERROR, registered.reason);
    }

    const accepted = this.writeQueue.push(frame);
    if (!accepted) {
      this.pending.remove(requestId);
      throw new RpcError(RPC_ERROR_CODES.BACKPRESSURE);
    }
    return registered.promise;
  }

  private async notifyCancel(requestId: string): Promise<void> {
    // Best-effort: worker may still be running the request; ask it to cancel.
    try {
      await this.request("system.cancel", { target_request_id: requestId }, { timeoutMs: 1000 });
    } catch {
      // ignore: cancellation is best-effort
    }
  }

  async cancelRequest(requestId: string): Promise<CancelResult> {
    const result = await this.request<CancelResult>("system.cancel", { target_request_id: requestId });
    return result;
  }

  async health(): Promise<HealthResult> {
    const result = await this.request<HealthResult>("system.health", {});
    const v = validateResponse({ request_id: "health", ok: true, result, error: null });
    if (!v.ok) throw new RpcError(RPC_ERROR_CODES.PROTOCOL_ERROR, "invalid health result");
    return result;
  }

  subscribeEvents(handler: EventSubscriber): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  /** Graceful shutdown: send system.shutdown, wait for exit, force-kill on deadline. */
  async stop(): Promise<void> {
    if (this.stateValue === "STOPPED") return;
    this.intentionalStop = true;
    this.setState("STOPPING");
    const proc = this.process;
    if (!proc) {
      this.setState("STOPPED");
      return;
    }
    // Stop accepting new work: fail all pending, then send system.shutdown via rawRequest.
    this.pending.failAll(new RpcError(RPC_ERROR_CODES.SHUTDOWN));
    try {
      await this.rawRequest("system.shutdown", {}, { timeoutMs: this.options.gracefulShutdownTimeoutMs });
    } catch {
      // worker may exit before responding; fall through to process exit wait
    }
    await proc.stop(this.options.gracefulShutdownTimeoutMs);
    this.setState("STOPPED");
    this.writeQueue = null;
    this.readyHandler = null;
  }

  private killWorker(): void {
    this.process?.forceKill();
    this.process = null;
  }

  private setState(s: ClientState): void {
    this.stateValue = s;
  }
}
