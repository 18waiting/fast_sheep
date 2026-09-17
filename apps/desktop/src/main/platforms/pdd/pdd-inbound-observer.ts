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

export interface PddInboundObserverOptions {
  webContents: WebContents;
  shopId: string;
  allowedUrl(url: string): boolean;
  getDocumentBinding(): PddInboundDocumentBinding | null;
  onConnection(connection: PddConnectionEvidence): void;
  onFrame(frame: PddObservedFrame): void;
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
  private initialNavigationSeen = false;
  private lifecycleId = 0;
  private messageHandler: ((_event: unknown, method: string, params: Record<string, unknown>, cdpSessionId: string) => void) | null = null;
  private detachHandler: ((_event: unknown, reason: string) => void) | null = null;
  private navigationHandler: ((_event: unknown, _url: string, isInPlace: boolean, isMainFrame: boolean) => void) | null = null;
  private destroyedHandler: (() => void) | null = null;

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
      this.handleDebuggerMessage(method, params, cdpSessionId, lifecycleId);
    };
    this.detachHandler = (_event, reason) => {
      this.stop("EXTERNAL_DEBUGGER_DETACH:" + reason, lifecycleId);
    };
    this.navigationHandler = (_event, _url, isInPlace, isMainFrame) => {
      if (isMainFrame !== true || isInPlace === true || lifecycleId !== this.lifecycleId || this.terminal) return;
      if (!this.initialNavigationSeen) {
        this.initialNavigationSeen = true;
        return;
      }
      this.stop("MAIN_DOCUMENT_REPLACEMENT", lifecycleId);
    };
    this.destroyedHandler = () => this.stop("WEBCONTENTS_DESTROYED", lifecycleId);

    this.debugger.on("message", this.messageHandler as never);
    this.debugger.on("detach", this.detachHandler as never);
    this.webContents.on("did-start-navigation", this.navigationHandler as never);
    this.webContents.on("destroyed", this.destroyedHandler as never);

    const enablePromise = Promise.resolve()
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

  private handleDebuggerMessage(method: string, params: Record<string, unknown>, cdpSessionId: string, lifecycleId: number): void {
    if (this.terminal || !this.enabled || lifecycleId !== this.lifecycleId) return;
    if (!this.allowedCdpSessionIds.has(cdpSessionId)) return;

    if (method === "Network.webSocketCreated") {
      const requestId = typeof params.requestId === "string" ? params.requestId : null;
      const url = typeof params.url === "string" ? params.url : null;
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

  stop(reason: string, lifecycleId = this.lifecycleId): void {
    if (this.terminal || lifecycleId !== this.lifecycleId) return;
    this.terminal = true;
    this.enabled = false;
    this.connections.clear();
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
      messageListenerCount: typeof this.debugger.listenerCount === "function" ? this.debugger.listenerCount("message") : null,
      navigationListenerCount: typeof this.webContents.listenerCount === "function" ? this.webContents.listenerCount("did-start-navigation") : null,
    };
  }

  private connectionKey(connection: { requestId: string; cdpSessionId: string; observerLifecycleId: number }): string {
    return [this.observerId, connection.observerLifecycleId, connection.cdpSessionId, connection.requestId].join("|");
  }
}
