import type { WebContents } from "electron";
import type { PddInboundDocumentBinding } from "./pdd-session-host.js";
import { connectionEvidenceHash, type PddConnectionEvidence } from "./pdd-main-admission.js";

export interface PddInboundObserverStartHandle {
  readonly lifecycleId: number;
  readonly enablePromise: Promise<void>;
}

export interface PddObservedFrame {
  readonly connection: PddConnectionEvidence;
  readonly cdpSessionId: string;
  readonly requestId: string;
  readonly payloadData: string;
  readonly opcode: number;
  readonly timestamp?: number;
}

/** Immutable, trusted HTTP request-start evidence captured from Main observation. */
export interface PddHttpRequestBinding {
  readonly connection: PddConnectionEvidence;
  readonly method: string;
  readonly url: string;
}

/** A fully-read, allowed HTTP response body bound to its request-start evidence. */
export interface PddObservedHttpResponse {
  readonly binding: PddHttpRequestBinding;
  readonly status: number;
  readonly mimeType: string;
  readonly body: string;
}
export interface PddInboundObserverOptions {
  webContents: WebContents;
  shopId: string;
  allowedUrl(url: string): boolean;
  getDocumentBinding(): PddInboundDocumentBinding | null;
  onConnection(connection: PddConnectionEvidence): void;
  onFrame(frame: PddObservedFrame): void;
  /** Trusted-request-start evidence for an allowed HTTP response observation. */
  onHttpRequest?(binding: PddHttpRequestBinding): void;
  /** Called only after an allowed response body was fully read and re-validated. */
  onHttpResponse?(frame: PddObservedHttpResponse): void;
  /**
   * Diagnostic-only WebSocket observation sink. Frames are reported with their trusted
   * connection origin/opcode for in-memory matching. This NEVER widens the canonical
   * ingress allowlist and is not used to admit messages.
   */
  onDiagnosticWsFrame?(frame: { readonly origin: string; readonly requestId: string; readonly direction: "IN" | "OUT"; readonly opcode: number; readonly payloadData: string; readonly bound: boolean }): void;
  /** Explicit HTTP allowlist: exact origin + path + method. No wildcard domain match. */
  allowedHttpRequest?(method: string, url: string): boolean;
  onStopped?(reason: string): void;
  allowedCdpSessionIds?: readonly string[];
  networkEnableCommand?: () => Promise<unknown>;
}

interface DebuggerLike {
  attach(version?: string): void;
  detach(): void;
  isAttached(): boolean;
  sendCommand(method: string, ...args: unknown[]): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  once?(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener(event: string, listener: (...args: unknown[]) => void): unknown;
  listenerCount?(event: string): number;
}

interface WebContentsLike {
  debugger: DebuggerLike;
  isDestroyed(): boolean;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener(event: string, listener: (...args: unknown[]) => void): unknown;
  listenerCount?(event: string): number;
}

export class PddInboundObserver {
  private readonly webContents: WebContentsLike;
  private readonly debugger: DebuggerLike;
  private readonly allowedCdpSessionIds: Set<string>;
  private readonly connections = new Map<string, PddConnectionEvidence>();
  private readonly networkEnableCommand: () => Promise<unknown>;
  private readonly onStopped: ((reason: string) => void) | undefined;
  private terminal = false;
  private enabled = false;
  /** Advances on every stop so an async HTTP body read can detect invalidation. */
  private lifecycleEpoch = 0;
  /**
   * Advances on every main-frame navigation (initial load or replacement). A pending HTTP
   * body read captured under an older navigation epoch must never be handed to a newer
   * document identity.
   */
  private navigationEpoch = 0;
  private initialNavigationSeen = false;
  private lifecycleId = 0;
  private messageHandler: ((_event: unknown, method: string, params: Record<string, unknown>, cdpSessionId: string) => void) | null = null;
  private detachHandler: ((_event: unknown, reason: string) => void) | null = null;
  private navigationHandler: ((_event: unknown, _url: string, isInPlace: boolean, isMainFrame: boolean) => void) | null = null;
  private destroyedHandler: (() => void) | null = null;
  /** requestKey -> trusted request-start binding. Never reconstructed after the fact. */
  private readonly httpRequests = new Map<string, PddHttpRequestBinding>();
  /** requestKey -> response metadata seen at responseReceived (body not yet read). */
  private readonly httpResponses = new Map<string, { status: number; mimeType: string }>();
  /** Sanitized counters: how many HTTP requests were offered to the allowlist, and how many were refused. No URLs are stored. */
  private httpCandidateChecks = 0;
  private httpCandidateRejected = 0;
  private httpResponseForBound = 0;
  private httpLoadingFinishedForBound = 0;
  private httpBodyReadAttempts = 0;
  private httpBodyReadOk = 0;
  private httpBodyReadStopped: Record<string, number> = {};
  /** Accepted (allowlisted) requests whose load failed before any response arrived. */
  private httpAcceptedLoadingFailed = 0;
  /** Responses seen whose request key has no trusted request-start binding. */
  private httpResponseUnmatched = 0;
  /** requestIds of allowlisted requests only (opaque ids, no URLs) and their response tally. */
  private readonly acceptedRequestIds = new Set<string>();
  private httpResponseForAcceptedId = 0;
  private httpLoadingFinishedForAcceptedId = 0;
  /** Allowlisted requests that could not be bound because no document binding existed yet. */
  private httpAcceptedWithoutBinding = 0;
  /** Sanitized tally of allowlist rejections by pathname only (no origin, no query, no values). */
  private readonly httpRejectedPathnames = new Map<string, number>();
  /** Diagnostic-only socket bindings by requestId (origin recorded, never the full URL). */
  private readonly diagSockets = new Map<string, string>();
  private diagWsOrigins: Record<string, number> = {};
  private diagWsFramesIn: Record<string, number> = {};
  private diagWsFramesOut: Record<string, number> = {};
  private diagWsUnbound = 0;
  /** CDP child sessions auto-attached by THIS observer's own debugger. */
  private readonly childSessions = new Set<string>();

  readonly observerId: string;

  constructor(private readonly options: PddInboundObserverOptions) {
    this.webContents = options.webContents as unknown as WebContentsLike;
    this.debugger = this.webContents.debugger;
    this.allowedCdpSessionIds = new Set(options.allowedCdpSessionIds ?? [""]);
    this.networkEnableCommand = options.networkEnableCommand ?? (() => this.debugger.sendCommand("Network.enable"));
    this.onStopped = options.onStopped;
    this.observerId = "pdd-observer-" + options.shopId + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  get targetWebContents(): WebContents { return this.options.webContents; }
  get activeLifecycleId(): number { return this.lifecycleId; }
  get isTerminal(): boolean { return this.terminal; }
  get isEnabled(): boolean { return this.enabled; }

  start(): PddInboundObserverStartHandle {
    if (this.terminal) throw new Error("pdd inbound observer is terminal");
    this.lifecycleId += 1;
    const lifecycleId = this.lifecycleId;
    if (!this.debugger.isAttached()) this.debugger.attach("1.3");

    this.messageHandler = (_event, method, params, cdpSessionId) => {
      void this.handleDebuggerMessage(method, params, cdpSessionId, lifecycleId).catch(() => undefined);
    };
    this.detachHandler = (_event, reason) => {
      this.stop("EXTERNAL_DEBUGGER_DETACH:" + reason, lifecycleId);
    };
    this.navigationHandler = (_event, _url, isInPlace, isMainFrame) => {
      if (isMainFrame !== true || lifecycleId !== this.lifecycleId || this.terminal) return;
      this.navigationEpoch += 1;
      // The first observed main-frame navigation establishes the initial document,
      // whether or not it is reported as in-place. Only a later non-in-place
      // main-frame navigation is a document replacement that terminates the lifecycle.
      if (!this.initialNavigationSeen) {
        this.initialNavigationSeen = true;
        return;
      }
      if (isInPlace === true) return;
      this.stop("MAIN_DOCUMENT_REPLACEMENT", lifecycleId);
    };
    this.destroyedHandler = () => this.stop("WEBCONTENTS_DESTROYED", lifecycleId);

    this.debugger.on("message", this.messageHandler as never);
    this.debugger.on("detach", this.detachHandler as never);
    this.webContents.on("did-start-navigation", this.navigationHandler as never);
    this.webContents.on("destroyed", this.destroyedHandler as never);

    const enablePromise = Promise.resolve()
      .then(() => this.enableChildTargetObservation())
      .then(() => this.networkEnableCommand())
      .then(() => {
        if (this.terminal || lifecycleId !== this.lifecycleId) return;
        this.enabled = true;
      })
      .catch((error) => {
        this.stop("NETWORK_ENABLE_FAILED", lifecycleId);
        throw error;
      });
    void enablePromise.catch(() => undefined);
    return { lifecycleId, enablePromise };
  }

  /**
   * Enable child-target observation (iframes / workers) on THIS webContents' debugger.
   * Without setAutoAttach, child-target Network.* events are never delivered to the
   * parent session at all. Sessions accepted here come only from this debugger's own
   * attach flow, so they are attributable to this trusted WebContents - arbitrary
   * session ids are never accepted.
   */
  private async enableChildTargetObservation(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bounded = new Promise<void>((resolve) => { timer = setTimeout(() => resolve(), 2000); }); // CHILD_TARGET_ENABLE_TIMEOUT
    const work = (async () => {
      try {
        await this.debugger.sendCommand("Target.setDiscoverTargets", { discover: true });
        await this.debugger.sendCommand("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
      } catch {
        // Non-fatal: main-frame observation still applies.
      }
    })();
    try { await Promise.race([work, bounded]); } finally { clearTimeout(timer); }
  }

  private async handleDebuggerMessage(method: string, params: Record<string, unknown>, cdpSessionId: string, lifecycleId: number): Promise<void> {
    if (method === "Target.attachedToTarget") {
      const params0 = params as { sessionId?: unknown };
      const child = typeof params0.sessionId === "string" ? params0.sessionId : null;
      if (child) {
        this.childSessions.add(child);
        this.allowedCdpSessionIds.add(child);
        void this.debugger.sendCommand("Network.enable", {}, child).catch(() => undefined);
      }
      return;
    }
    if (method === "Target.detachedFromTarget") {
      const params0 = params as { sessionId?: unknown };
      const child = typeof params0.sessionId === "string" ? params0.sessionId : null;
      if (child) { this.childSessions.delete(child); this.allowedCdpSessionIds.delete(child); }
      return;
    }
    if (this.terminal || !this.enabled || lifecycleId !== this.lifecycleId) return;
    // Root session ("") plus this observer's own auto-attached child sessions only.
    if (!this.allowedCdpSessionIds.has(cdpSessionId)) return;

    if (method === "Network.requestWillBeSent") {
      const requestId = typeof params.requestId === "string" ? params.requestId : null;
      const request = params.request as { url?: unknown; method?: unknown } | undefined;
      const url = request && typeof request.url === "string" ? request.url : null;
      const httpMethod = request && typeof request.method === "string" ? request.method.toUpperCase() : null;
      if (!requestId || !url || !httpMethod) return;
      this.httpCandidateChecks += 1;
      if (!this.options.allowedHttpRequest || !this.options.allowedHttpRequest(httpMethod, url)) {
        this.httpCandidateRejected += 1;
        try { const p = new URL(url).pathname; if (this.httpRejectedPathnames.size < 40 || this.httpRejectedPathnames.has(p)) this.httpRejectedPathnames.set(p, (this.httpRejectedPathnames.get(p) ?? 0) + 1); } catch { /* ignore malformed */ }
        return;
      }
      this.acceptedRequestIds.add(requestId);
      const binding = this.options.getDocumentBinding();
      if (!binding) { this.httpAcceptedWithoutBinding += 1; return; }
      const key = this.requestKey(lifecycleId, cdpSessionId, requestId);
      if (this.httpRequests.has(key)) return;
      const connection: PddConnectionEvidence = Object.freeze({
        webContents: this.options.webContents,
        observerId: this.observerId,
        observerLifecycleId: lifecycleId,
        sessionId: binding.sessionId,
        shopId: binding.shopId,
        documentGeneration: binding.documentGeneration,
        cdpSessionId,
        requestId,
        url,
      });
      const evidence: PddHttpRequestBinding = Object.freeze({ connection, method: httpMethod, url });
      this.httpRequests.set(key, evidence);
      this.httpResponses.delete(key);
      this.options.onHttpRequest?.(evidence);
      return;
    }

    if (method === "Network.responseReceived") {
      const requestId = typeof params.requestId === "string" ? params.requestId : null;
      if (!requestId) return;
      const key = this.requestKey(lifecycleId, cdpSessionId, requestId);
      if (this.acceptedRequestIds.has(requestId)) this.httpResponseForAcceptedId += 1;
      if (!this.httpRequests.has(key)) { this.httpResponseUnmatched += 1; return; }
      this.httpResponseForBound += 1;
      const response = params.response as { status?: unknown; mimeType?: unknown } | undefined;
      const status = response && typeof response.status === "number" ? response.status : 0;
      const mimeType = response && typeof response.mimeType === "string" ? response.mimeType : "";
      this.httpResponses.set(key, { status, mimeType });
      return;
    }

    if (method === "Network.loadingFinished") {
      const requestId = typeof params.requestId === "string" ? params.requestId : null;
      if (!requestId) return;
      const key = this.requestKey(lifecycleId, cdpSessionId, requestId);
      const evidence = this.httpRequests.get(key);
      const responseInfo = this.httpResponses.get(key);
      if (this.acceptedRequestIds.has(requestId)) this.httpLoadingFinishedForAcceptedId += 1;
      if (!evidence || !responseInfo) return;
      this.httpLoadingFinishedForBound += 1;
      // A request without a trusted start binding can never be reconstructed here.
      await this.readAndEmitHttpBody(key, evidence, responseInfo, lifecycleId);
      return;
    }

    if (method === "Network.loadingFailed") {
      const requestId = typeof params.requestId === "string" ? params.requestId : null;
      if (!requestId) return;
      const key = this.requestKey(lifecycleId, cdpSessionId, requestId);
      if (this.httpRequests.has(key)) this.httpAcceptedLoadingFailed += 1;
      this.httpRequests.delete(key);
      this.httpResponses.delete(key);
      return;
    }
    if (method === "Network.webSocketCreated") {
      const requestId = typeof params.requestId === "string" ? params.requestId : null;
      const url = typeof params.url === "string" ? params.url : null;
      if (requestId && url) {
        try {
          const origin = new URL(url).origin;
          this.diagSockets.set(this.requestKey(lifecycleId, cdpSessionId, requestId), origin);
          this.diagWsOrigins[origin] = (this.diagWsOrigins[origin] ?? 0) + 1;
        } catch { /* malformed url: no diagnostic binding */ }
      }
      if (!requestId || !url || !this.options.allowedUrl(url)) return;
      const binding = this.options.getDocumentBinding();
      if (!binding) return;
      const connection: PddConnectionEvidence = Object.freeze({
        webContents: this.options.webContents,
        observerId: this.observerId,
        observerLifecycleId: lifecycleId,
        sessionId: binding.sessionId,
        shopId: binding.shopId,
        documentGeneration: binding.documentGeneration,
        cdpSessionId,
        requestId,
        url,
      });
      const key = this.connectionKey(connection);
      if (!this.connections.has(key)) {
        this.connections.set(key, connection);
        this.options.onConnection(connection);
      }
      return;
    }

    if (method === "Network.webSocketFrameReceived" || method === "Network.webSocketFrameSent") {
      const rid = typeof params.requestId === "string" ? params.requestId : null;
      const p0 = params.response as { payloadData?: unknown; opcode?: unknown } | undefined;
      if (rid && p0) {
        const origin = this.diagSockets.get(this.requestKey(lifecycleId, cdpSessionId, rid));
        const op = typeof p0.opcode === "number" ? p0.opcode : -1;
        const key = "opcode:" + op;
        if (origin === undefined) this.diagWsUnbound += 1;
        else if (method === "Network.webSocketFrameReceived") this.diagWsFramesIn[key] = (this.diagWsFramesIn[key] ?? 0) + 1;
        else this.diagWsFramesOut[key] = (this.diagWsFramesOut[key] ?? 0) + 1;
        if (this.options.onDiagnosticWsFrame) {
          this.options.onDiagnosticWsFrame({ origin: origin ?? "", requestId: rid, direction: method === "Network.webSocketFrameReceived" ? "IN" : "OUT", opcode: op, payloadData: typeof p0.payloadData === "string" ? p0.payloadData : "", bound: origin !== undefined });
        }
      }
      if (method === "Network.webSocketFrameSent") return;
    }

    if (method === "Network.webSocketFrameReceived") {
      const requestId = typeof params.requestId === "string" ? params.requestId : null;
      if (!requestId) return;
      const connection = this.connections.get(this.connectionKey({ requestId, cdpSessionId, observerLifecycleId: lifecycleId }));
      if (!connection) return;
      const response = params.response as { payloadData?: unknown; opcode?: unknown } | undefined;
      if (!response || response.opcode !== 1 || typeof response.payloadData !== "string") return;
      this.options.onFrame({
        connection,
        cdpSessionId,
        requestId,
        payloadData: response.payloadData,
        opcode: 1,
        ...(typeof params.timestamp === "number" ? { timestamp: params.timestamp } : {}),
      });
    }
  }

  private requestKey(lifecycleId: number, cdpSessionId: string, requestId: string): string {
    return [this.observerId, lifecycleId, cdpSessionId, requestId].join("|");
  }

  /**
   * Read a response body only after loadingFinished, and re-validate the lifecycle and
   * binding before and after the async read. A stale navigation, detach, destroy or stop
   * must never hand an old body to a current identity.
   */
  private async readAndEmitHttpBody(
    key: string,
    evidence: PddHttpRequestBinding,
    responseInfo: { status: number; mimeType: string },
    lifecycleId: number,
  ): Promise<void> {
    this.httpBodyReadAttempts += 1;
    const stop = (reason: string) => { this.httpBodyReadStopped[reason] = (this.httpBodyReadStopped[reason] ?? 0) + 1; };
    try {
      if (this.terminal || !this.enabled || lifecycleId !== this.lifecycleId) { stop("LIFECYCLE_INVALID"); return; }
      const currentBinding = this.options.getDocumentBinding();
      if (!currentBinding) { stop("BINDING_ABSENT"); return; }
      const requestBinding = evidence.connection;
      if (
        requestBinding.sessionId !== currentBinding.sessionId ||
        requestBinding.shopId !== currentBinding.shopId ||
        requestBinding.documentGeneration !== currentBinding.documentGeneration
      ) {
        stop("BINDING_MISMATCH_BEFORE_READ");
        return;
      }
      const epochAtRead = this.lifecycleEpoch;
      const navigationAtRead = this.navigationEpoch;
      const result = await this.debugger.sendCommand("Network.getResponseBody", { requestId: requestBinding.requestId }) as
        | { body?: unknown; base64Encoded?: unknown }
        | undefined;
      if (
        this.terminal ||
        !this.enabled ||
        lifecycleId !== this.lifecycleId ||
        this.lifecycleEpoch !== epochAtRead ||
        this.navigationEpoch !== navigationAtRead
      ) {
        stop("INVALIDATED_DURING_READ");
        return;
      }
      const afterBinding = this.options.getDocumentBinding();
      if (
        !afterBinding ||
        requestBinding.sessionId !== afterBinding.sessionId ||
        requestBinding.shopId !== afterBinding.shopId ||
        requestBinding.documentGeneration !== afterBinding.documentGeneration
      ) {
        stop("BINDING_MISMATCH_AFTER_READ");
        return;
      }
      if (!result || typeof result.body !== "string") { stop("BODY_UNAVAILABLE"); return; }
      if (result.base64Encoded === true) { stop("BODY_BASE64"); return; }
      this.httpBodyReadOk += 1;
      this.options.onHttpResponse?.({ binding: evidence, status: responseInfo.status, mimeType: responseInfo.mimeType, body: result.body });
    } catch {
      // Body read failure is an explicit stop for this request: no fallback, no retry.
      this.httpBodyReadStopped["READ_FAILED"] = (this.httpBodyReadStopped["READ_FAILED"] ?? 0) + 1;
    } finally {
      this.httpRequests.delete(key);
      this.httpResponses.delete(key);
    }
  }
  stop(reason: string, lifecycleId = this.lifecycleId): void {
    if (this.terminal || lifecycleId !== this.lifecycleId) return;
    this.terminal = true;
    this.enabled = false;
    this.lifecycleEpoch += 1;
    this.connections.clear();
    this.httpRequests.clear();
    this.httpResponses.clear();
    for (const child of this.childSessions) this.allowedCdpSessionIds.delete(child);
    this.childSessions.clear();
    if (this.messageHandler) this.debugger.removeListener("message", this.messageHandler as never);
    if (this.detachHandler) this.debugger.removeListener("detach", this.detachHandler as never);
    if (this.navigationHandler) this.webContents.removeListener("did-start-navigation", this.navigationHandler as never);
    if (this.destroyedHandler) this.webContents.removeListener("destroyed", this.destroyedHandler as never);
    try { if (this.debugger.isAttached()) this.debugger.detach(); } catch {}
    this.onStopped?.(reason);
  }

  snapshot(): Record<string, unknown> {
    return {
      observerId: this.observerId,
      lifecycleId: this.lifecycleId,
      terminal: this.terminal,
      enabled: this.enabled,
      connectionCount: this.connections.size,
      httpRequestCount: this.httpRequests.size,
      httpCandidateChecks: this.httpCandidateChecks,
      httpCandidateRejected: this.httpCandidateRejected,
      httpResponseForBound: this.httpResponseForBound,
      httpLoadingFinishedForBound: this.httpLoadingFinishedForBound,
      httpBodyReadAttempts: this.httpBodyReadAttempts,
      httpBodyReadOk: this.httpBodyReadOk,
      httpBodyReadStopped: { ...this.httpBodyReadStopped },
      httpAcceptedLoadingFailed: this.httpAcceptedLoadingFailed,
      httpResponseUnmatched: this.httpResponseUnmatched,
      acceptedRequestIdCount: this.acceptedRequestIds.size,
      httpResponseForAcceptedId: this.httpResponseForAcceptedId,
      httpLoadingFinishedForAcceptedId: this.httpLoadingFinishedForAcceptedId,
      httpAcceptedWithoutBinding: this.httpAcceptedWithoutBinding,
      httpRejectedPathnames: Object.fromEntries(this.httpRejectedPathnames),
      wsOrigins: { ...this.diagWsOrigins },
      wsFramesIn: { ...this.diagWsFramesIn },
      wsFramesOut: { ...this.diagWsFramesOut },
      wsUnboundFrames: this.diagWsUnbound,
      childSessionCount: this.childSessions.size,
      messageListenerCount: typeof this.debugger.listenerCount === "function" ? this.debugger.listenerCount("message") : null,
      navigationListenerCount: typeof this.webContents.listenerCount === "function" ? this.webContents.listenerCount("did-start-navigation") : null,
    };
  }

  private connectionKey(connection: { requestId: string; cdpSessionId: string; observerLifecycleId: number }): string {
    return [this.observerId, connection.observerLifecycleId, connection.cdpSessionId, connection.requestId].join("|");
  }
}
