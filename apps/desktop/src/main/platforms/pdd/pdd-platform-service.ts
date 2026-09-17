// M7 PDD platform service (clean-room). Main-side composition root for the PDD
// vertical slice: per-shop sessions/views, routing PlatformAdapter, page-event
// routing to the orchestrator, status projection.
import type { PlatformAdapter, ConversationOrchestrator, SendAttempt, TransferDecision } from "@fastwork/orchestrator";
import type { InboundEnvelope } from "@fastwork/domain";
import type { PddPageEvent, PddPageCommandResult, PddCanonicalIdentityBinding, PddCanonicalInboundMessage, PddCanonicalScopeBinding } from "@fastwork/platform-pdd";
import { PddPlatformAdapter } from "@fastwork/platform-pdd";
import type { PlatformStatusChangedEvent } from "@fastwork/desktop-ipc";
import type { WebContents } from "electron";
import { PddSessionHost, type PddInboundDocumentBinding, type PddInboundIngressContext } from "./pdd-session-host.js";
import { PddViewHost, type ViewBounds } from "./pdd-view-host.js";
import { PddPreloadBridge } from "./pdd-preload-bridge.js";
import { PddOrchestratorBridge, type PddInboundMessage } from "./pdd-orchestrator-bridge.js";
import { processPddInboundIngress, type PddCanonicalEnvelopeValidator, type PddInboundIngressInput, type PddInboundIngressResult } from "./pdd-inbound-ingress.js";
import { PddInboundObserver, type PddInboundObserverOptions, type PddInboundObserverStartHandle, type PddObservedFrame } from "./pdd-inbound-observer.js";
import { DENY_ALL_MAIN_ADMISSION_PROVIDER, PddMainAdmissionRegistry, type PddCanonicalIngressMode, type PddConnectionEvidence, type PddMainAdmissionProvider, type PddMainAdmissionRequest } from "./pdd-main-admission.js";
import { PDD_PRODUCTION_CHAT_URL, PDD_TOP_LEVEL_HOST, type PddNavigationMode } from "./pdd-navigation-policy.js";

export interface PlatformStatusViewLike {
  shop_id: string;
  platform: string;
  session_status: string;
  view_visible: boolean;
  last_error?: string;
  capabilities?: Record<string, unknown>;
}

export interface PddPlatformServiceOptions {
  navigationMode: PddNavigationMode;
  orchestrator: ConversationOrchestrator;
  allowedProductionHosts?: readonly string[];
  productionEntryUrl?: string;
  /** Test mode: local synthetic fixture per shop. */
  fixturePathFor?: (shopId: string) => string | undefined;
  makeView?: (shopId: string, navigationMode: PddNavigationMode) => PddViewHost;
  onStatusChanged?: (ev: PlatformStatusChangedEvent) => void;
  onInboundMessage?: (message: PddInboundMessage) => Promise<void>;
  onHumanReply?: (shopId: string, conversationId: string) => Promise<void>;
  onConversationChange?: (shopId: string) => void;
  resolveInboundScope?: (document: PddInboundDocumentBinding) => PddCanonicalScopeBinding | null;
  resolveInboundIdentity?: (
    message: PddCanonicalInboundMessage,
    document: PddInboundDocumentBinding,
  ) => PddCanonicalIdentityBinding | null;
  onCanonicalInbound?: (envelope: InboundEnvelope) => unknown;
  canonicalEnvelopeValidator?: PddCanonicalEnvelopeValidator | null;
  /** Production default is DISABLED. CANONICAL_CONTROLLED is Main-composed only. */
  canonicalIngressMode?: PddCanonicalIngressMode;
  mainAdmissionProvider?: PddMainAdmissionProvider;
  /** Controlled fixture/loopback frame decoder; production wiring must supply or fail closed. */
  decodeInboundFrame?: (payloadData: string) => PddInboundIngressInput | null;
  /** Local-only allowlist for the controlled observer; no historical Titan URL is enabled implicitly. */
  allowedInboundWebSocketUrl?: (url: string) => boolean;
  /** Test seam for observer lifecycle; controlled smoke must use the real default observer. */
  createInboundObserver?: (options: PddInboundObserverOptions) => PddInboundObserver;
  revision?: () => number;
}

function asObject(value: unknown): object | null {
  return typeof value === "object" && value !== null ? value : null;
}

function isThenable(value: unknown): value is { then(onFulfilled: () => void, onRejected: () => void): unknown } {
  return ((typeof value === "object" && value !== null) || typeof value === "function")
    && typeof (value as { then?: unknown }).then === "function";
}

function stoppedIngress(reason: string, diagnostics: readonly string[]): PddInboundIngressResult {
  return { status: "STOPPED", reason: reason as never, diagnostics };
}

export class PddPlatformService {
  private readonly sessions = new Map<string, PddSessionHost>();
  private readonly bridges = new Map<string, PddPreloadBridge>();
  private readonly adapters = new Map<string, PddPlatformAdapter>();
  private readonly trustedWebContents = new Set<WebContents>();
  private readonly senderSessions = new Map<object, PddSessionHost>();
  private readonly orchestratorBridge: PddOrchestratorBridge;
  private readonly options: PddPlatformServiceOptions;
  private readonly navigationMode: PddNavigationMode;
  private readonly canonicalIngressMode: PddCanonicalIngressMode;
  private readonly admissionRegistry: PddMainAdmissionRegistry;
  private readonly inboundObservers = new Map<string, PddInboundObserver>();
  private readonly observerStartups = new Map<string, PddInboundObserverStartHandle>();
  private readonly connections = new Map<string, PddConnectionEvidence>();
  private readonly connectionAdmissions = new Map<string, string>();
  private readonly revokedConnectionKeys = new Set<string>();
  private lastAdmissionId: string | null = null;

  constructor(options: PddPlatformServiceOptions) {
    if (options.navigationMode !== "FIXTURE" && options.navigationMode !== "PRODUCTION_READ_ONLY") {
      throw new Error("navigationMode is required");
    }
    this.options = options;
    this.navigationMode = options.navigationMode;
    const canonicalIngressMode = options.canonicalIngressMode ?? (options.navigationMode === "FIXTURE" ? "LEGACY" : "DISABLED");
    if (canonicalIngressMode !== "DISABLED" && canonicalIngressMode !== "CANONICAL_CONTROLLED" && canonicalIngressMode !== "LEGACY") {
      throw new Error("canonicalIngressMode is invalid");
    }
    this.canonicalIngressMode = canonicalIngressMode;
    this.admissionRegistry = new PddMainAdmissionRegistry(options.mainAdmissionProvider ?? DENY_ALL_MAIN_ADMISSION_PROVIDER);
    this.orchestratorBridge = new PddOrchestratorBridge(options.orchestrator);
  }

  /** PDD page event from the trusted page preload. Sender ownership is checked before state mutation. */
  handlePageEvent(payload: unknown, sender?: unknown): void {
    let ev = payload as PddPageEvent;
    const senderObject = asObject(sender);
    let session = senderObject ? this.senderSessions.get(senderObject) : undefined;

    // Legacy compatibility may locate by payload only. DISABLED and
    // CANONICAL_CONTROLLED require the actual sender to be known.
    if (!session && !senderObject && this.canonicalIngressMode === "LEGACY") {
      session = ev.session_id ? this.sessionBySessionId(ev.session_id) : undefined;
      if (!session && ev.shop_id) {
        for (const candidate of this.sessions.values()) {
          if (candidate.state.shopId === ev.shop_id) { session = candidate; break; }
        }
      }
    }
    if (!session) return;
    if (ev.session_id !== session.state.sessionId) return;
    if (ev.shop_id !== undefined && ev.shop_id !== session.state.shopId) return;

    if (session.viewHost?.currentRouteKind === "LOGIN" && ev.event === "page_ready") {
      ev = { ...ev, event: "login_required" };
    }
    if (ev.event === "auth_reauth_required") {
      this.stopInboundObserver(session.state.shopId, "AUTH_REAUTH_REQUIRED");
    }
    session.handleEvent(ev);

    if (this.canonicalIngressMode === "LEGACY") {
      if (ev.event === "message_received" && ev.shop_id && ev.conversation_id && ev.content !== undefined) {
        void this.handleInbound({
          shop_id: ev.shop_id,
          conversation_id: ev.conversation_id,
          buyer_id: ev.buyer_id,
          buyer: ev.buyer,
          platform_message_id: ev.platform_message_id,
          content: ev.content,
          timestamp: ev.timestamp,
        });
      } else if (ev.event === "human_reply_detected" && ev.shop_id && ev.conversation_id) {
        void this.handleHumanReply(ev.shop_id, ev.conversation_id);
      } else if (ev.event === "conversation_changed" && ev.shop_id) {
        this.handleConversationChange(ev.shop_id);
      }
    }
    this.broadcastStatus(session.state.shopId);
  }

  handleCommandResult(payload: unknown, sender?: unknown): void {
    const result = payload as PddPageCommandResult;
    const senderObject = asObject(sender);
    if (senderObject) {
      const session = this.senderSessions.get(senderObject);
      if (!session) return;
      this.bridges.get(session.state.shopId)?.resolveResult(result);
      return;
    }
    if (this.canonicalIngressMode === "LEGACY") {
      for (const bridge of this.bridges.values()) bridge.resolveResult(result);
    }
  }

  private sessionBySessionId(sessionId: string): PddSessionHost | undefined {
    for (const s of this.sessions.values()) if (s.state.sessionId === sessionId) return s;
    return undefined;
  }

  private async handleInbound(message: PddInboundMessage): Promise<void> {
    if (this.options.onInboundMessage) await this.options.onInboundMessage(message);
    else await this.orchestratorBridge.onInboundMessage(message);
  }

  private async handleHumanReply(shopId: string, conversationId: string): Promise<void> {
    if (this.options.onHumanReply) await this.options.onHumanReply(shopId, conversationId);
    else await this.orchestratorBridge.onHumanReply(shopId, conversationId);
  }

  private handleConversationChange(shopId: string): void {
    if (this.options.onConversationChange) this.options.onConversationChange(shopId);
    else this.orchestratorBridge.onConversationChange(shopId);
  }

  /** Create/load/activate a PDD session for a shop (test mode loads local fixture). */
  async activate(shopId: string): Promise<void> {
    let session = this.sessions.get(shopId);
    let startup: PddInboundObserverStartHandle | null = null;
    if (!session) {
      const fixturePath = this.navigationMode === "FIXTURE" ? this.options.fixturePathFor?.(shopId) : undefined;
      const makeView = this.options.makeView ?? ((sid: string, navigationMode: PddNavigationMode) => new PddViewHost({
        shopId: sid,
        navigationMode,
        allowedProductionHosts: this.options.allowedProductionHosts?.length ? this.options.allowedProductionHosts : [PDD_TOP_LEVEL_HOST],
        productionEntryUrl: this.options.productionEntryUrl,
      }));
      const self = this;
      session = new PddSessionHost({
        shopId,
        makeView: () => makeView(shopId, this.navigationMode),
        onEvent: (ev) => this.onSessionEvent(shopId, ev),
        // Register the webContents as trusted BEFORE the page loads so the
        // preload's very first events pass the sender guard.
        onViewCreated: (view) => {
          self.trustedWebContents.add(view.webContents);
          self.senderSessions.set(view.webContents as object, session!);
          const bridge = new PddPreloadBridge(view);
          self.bridges.set(shopId, bridge);
          bridge.setMutationCommandsEnabled(self.navigationMode === "FIXTURE");
          if (self.navigationMode === "FIXTURE") {
            const adapter = new PddPlatformAdapter({ bridge, session: session!.state });
            self.adapters.set(shopId, adapter);
          }
          if (self.navigationMode === "PRODUCTION_READ_ONLY") {
            view.setRouteDecisionHandler?.((decision) => {
              const current = self.sessions.get(shopId);
              if (!current) return;
              if (decision.route === "LOGIN") {
                current.handleEvent({ event: "login_required", session_id: current.state.sessionId, shop_id: shopId } as PddPageEvent);
              } else if (decision.route === "BLOCKED") {
                current.handleEvent({ event: "dom_unsupported", session_id: current.state.sessionId, shop_id: shopId, reason: "ROUTE_NOT_ALLOWED" } as PddPageEvent);
              }
            });
          }
          if (self.canonicalIngressMode === "CANONICAL_CONTROLLED") {
            const observer = self.createInboundObserverForSession(shopId, view, session!);
            self.inboundObservers.set(shopId, observer);
            startup = observer.start();
            self.observerStartups.set(shopId, startup);
          }
        },
      });
      this.sessions.set(shopId, session);
      try {
        await session.createAndLoad(fixturePath);
        if (this.navigationMode === "PRODUCTION_READ_ONLY") {
          if (!session.viewHost) throw new Error("production PDD view was not created");
          const loadPromise = session.viewHost.loadProductionEntry(this.options.productionEntryUrl ?? PDD_PRODUCTION_CHAT_URL);
          await this.awaitObserverStartup(shopId, loadPromise, startup);
        } else if (startup) {
          await this.awaitObserverStartup(shopId, Promise.resolve(), startup);
        }
      } catch (error) {
        if (this.navigationMode === "PRODUCTION_READ_ONLY" && session) {
          session.handleEvent({ event: "dom_unsupported", session_id: session.state.sessionId, shop_id: shopId, reason: "PRODUCTION_ENTRY_CONFIG_INVALID" } as PddPageEvent);
        }
        this.stopInboundObserver(shopId, "INITIALIZATION_FAILED");
        session.dispose();
        this.sessions.delete(shopId);
        throw error;
      }
    } else {
      startup = this.observerStartups.get(shopId) ?? null;
    }
    session.activate();
    this.broadcastStatus(shopId);
  }

  private createInboundObserverForSession(shopId: string, view: PddViewHost, session: PddSessionHost): PddInboundObserver {
    const options: PddInboundObserverOptions = {
      webContents: view.webContents,
      shopId,
      allowedUrl: this.options.allowedInboundWebSocketUrl ?? ((url) => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === "ws:"
            && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1");
        } catch {
          return false;
        }
      }),
      allowedCdpSessionIds: [""],
      getDocumentBinding: () => session.getCurrentInboundDocumentBinding(),
      onConnection: (connection) => this.recordConnection(connection),
      onFrame: (frame) => this.handleObservedFrame(frame),
      onStopped: (reason) => this.handleObserverStopped(shopId, reason),
    };
    return this.options.createInboundObserver?.(options) ?? new PddInboundObserver(options);
  }

  private async awaitObserverStartup(shopId: string, loadPromise: Promise<unknown>, startup: PddInboundObserverStartHandle | null): Promise<void> {
    if (!startup) {
      await loadPromise;
      return;
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error("INBOUND_OBSERVER_STARTUP_TIMEOUT")), 8000);
    });
    try {
      const [loadResult, enableResult] = await Promise.allSettled([loadPromise, Promise.race([startup.enablePromise, timeoutPromise])]);
      if (loadResult.status === "rejected") throw loadResult.reason;
      if (enableResult.status === "rejected") throw enableResult.reason;
      if (this.observerStartups.get(shopId) !== startup) throw new Error("inbound observer startup superseded");
    } finally {
      clearTimeout(timeout);
    }
  }

  private recordConnection(connection: PddConnectionEvidence): void {
    const key = this.connectionKey(connection);
    if (!this.connections.has(key)) this.connections.set(key, connection);
  }

  private connectionKey(connection: Pick<PddConnectionEvidence, "observerId" | "observerLifecycleId" | "cdpSessionId" | "requestId">): string {
    return [connection.observerId, connection.observerLifecycleId, connection.cdpSessionId, connection.requestId].join("|");
  }

  private sameConnectionBinding(connection: PddConnectionEvidence, binding: PddInboundDocumentBinding): boolean {
    return connection.sessionId === binding.sessionId
      && connection.shopId === binding.shopId
      && connection.documentGeneration === binding.documentGeneration;
  }

  private handleObservedFrame(frame: PddObservedFrame): void {
    const connection = frame.connection;
    if (this.canonicalIngressMode !== "CANONICAL_CONTROLLED") {
      this.recordInboundDecision("CANONICAL_INGRESS_DISABLED");
      return;
    }
    const observer = this.inboundObservers.get(connection.shopId);
    if (!observer || observer.isTerminal || observer.activeLifecycleId !== connection.observerLifecycleId) {
      this.recordInboundDecision("OBSERVER_STALE_OR_TERMINAL");
      return;
    }
    if (!this.connections.has(this.connectionKey(connection))) {
      this.recordInboundDecision("UNBOUND_CONNECTION");
      return;
    }
    if (this.webContentsFor(connection.shopId) !== connection.webContents) {
      this.recordInboundDecision("WEBCONTENTS_MISMATCH");
      return;
    }
    const session = this.senderSessions.get(connection.webContents as object);
    if (!session || session.state.getStatus() !== "READY") {
      this.recordInboundDecision("SESSION_NOT_READY");
      return;
    }
    const currentBinding = session.getCurrentInboundDocumentBinding();
    if (!currentBinding || !this.sameConnectionBinding(connection, currentBinding)) {
      this.recordInboundDecision("STALE_DOCUMENT_BINDING");
      return;
    }
    const context = session.createInboundIngressContext(connection.webContents);
    if (!context) {
      this.recordInboundDecision("INVALID_DOCUMENT_CONTEXT");
      return;
    }
    const request: PddMainAdmissionRequest = { webContents: connection.webContents, connection, binding: currentBinding };
    const connectionKey = this.connectionKey(connection);
    if (this.revokedConnectionKeys.has(connectionKey)) {
      this.recordInboundDecision("MAIN_ADMISSION_REVOKED");
      return;
    }
    let admissionId = this.connectionAdmissions.get(connectionKey);
    if (!admissionId || !this.admissionRegistry.validate(admissionId, request)) {
      const admission = this.admissionRegistry.evaluate(request);
      if (!admission.granted) {
        this.recordInboundDecision("MAIN_ADMISSION_DENIED:" + admission.reason);
        return;
      }
      admissionId = admission.admissionId;
      this.connectionAdmissions.set(connectionKey, admissionId);
      this.lastAdmissionId = admissionId;
    }
    let input: PddInboundIngressInput | null;
    try {
      input = this.options.decodeInboundFrame?.(frame.payloadData) ?? null;
    } catch {
      this.recordInboundDecision("FRAME_DECODER_THREW");
      return;
    }
    if (!input) {
      this.recordInboundDecision("FRAME_DECODER_MISSING_OR_INVALID");
      return;
    }
    const result = this.handleAdmittedInboundIngress(connection.webContents, context, admissionId, input, request);
    this.recordInboundDecision(result.status === "MAPPED" ? "MAPPED" : result.status + ":" + result.reason);
  }

  revokeMainAdmissionsForShop(shopId: string): number {
    let revoked = 0;
    for (const [key, admissionId] of [...this.connectionAdmissions.entries()]) {
      const connection = this.connections.get(key);
      if (connection?.shopId !== shopId) continue;
      this.admissionRegistry.revoke(admissionId);
      this.connectionAdmissions.delete(key);
      this.revokedConnectionKeys.add(key);
      if (this.lastAdmissionId === admissionId) this.lastAdmissionId = null;
      revoked += 1;
    }
    return revoked;
  }

  revokeMainAdmission(admissionId: string): boolean {
    const target = [...this.connectionAdmissions.entries()].find(([, id]) => id === admissionId);
    this.admissionRegistry.revoke(admissionId);
    if (!target) return false;
    this.connectionAdmissions.delete(target[0]);
    this.revokedConnectionKeys.add(target[0]);
    if (this.lastAdmissionId === admissionId) this.lastAdmissionId = null;
    return true;
  }

  private handleObserverStopped(shopId: string, reason: string): void {
    const observer = this.inboundObservers.get(shopId);
    if (observer) this.admissionRegistry.revokeForWebContents(observer.targetWebContents);
    for (const [key, connection] of this.connections) {
      if (connection.shopId === shopId || (observer && connection.webContents === observer.targetWebContents)) {
        this.connections.delete(key);
        this.connectionAdmissions.delete(key);
        this.revokedConnectionKeys.delete(key);
      }
    }
    this.inboundObservers.delete(shopId);
    this.observerStartups.delete(shopId);
    this.recordInboundDecision("OBSERVER_STOPPED:" + reason);
  }

  private stopInboundObserver(shopId: string, reason: string): void {
    const observer = this.inboundObservers.get(shopId);
    if (observer && !observer.isTerminal) {
      observer.stop(reason);
    } else {
      this.handleObserverStopped(shopId, reason);
    }
  }

  handleAdmittedInboundIngress(
    sender: unknown,
    context: unknown,
    admissionId: string,
    input: unknown,
    request: PddMainAdmissionRequest,
  ): PddInboundIngressResult {
    if (this.canonicalIngressMode !== "CANONICAL_CONTROLLED") {
      return stoppedIngress("CANONICAL_INGRESS_DISABLED", Object.freeze([]));
    }
    const senderObject = asObject(sender);
    if (!senderObject) return { status: "REJECTED", reason: "UNTRUSTED_SENDER", diagnostics: Object.freeze([]) };
    const session = this.senderSessions.get(senderObject);
    if (!session) return { status: "REJECTED", reason: "UNTRUSTED_SENDER", diagnostics: Object.freeze([]) };
    const liveBinding = session.getCurrentInboundDocumentBinding();
    if (!liveBinding) return stoppedIngress("DOCUMENT_BINDING_UNAVAILABLE", Object.freeze([]));
    const liveRequest: PddMainAdmissionRequest = { webContents: senderObject as WebContents, connection: request.connection, binding: liveBinding };
    if (!this.admissionRegistry.validate(admissionId, liveRequest)) {
      return stoppedIngress("MAIN_ADMISSION_INVALIDATED", Object.freeze([]));
    }
    return this.handleTrustedInboundIngress(sender, context, input, () => {
      const current = session.getCurrentInboundDocumentBinding();
      return current !== null && this.admissionRegistry.validate(admissionId, { webContents: senderObject as WebContents, connection: request.connection, binding: current });
    });
  }

  private readonly inboundDecisionCounts = new Map<string, number>();

  private recordInboundDecision(reason: string): void {
    this.inboundDecisionCounts.set(reason, (this.inboundDecisionCounts.get(reason) ?? 0) + 1);
  }

  inboundDiagnostics(): Record<string, unknown> {
    return {
      mode: this.canonicalIngressMode,
      observers: [...this.inboundObservers.entries()].map(([shopId, observer]) => ({ shopId, ...observer.snapshot() })),
      decisions: Object.fromEntries(this.inboundDecisionCounts),
      connectionCount: this.connections.size,
      admissionCount: this.connectionAdmissions.size,
      revokedAdmissionCount: this.revokedConnectionKeys.size,
      lastAdmissionId: this.lastAdmissionId,
    };
  }

  private onSessionEvent(shopId: string, ev: PddPageEvent): void {
    // The service-level handler already processed business events; this hook
    // updates session state via handleEvent (already done) and broadcasts.
    this.broadcastStatus(shopId);
  }

  status(shopId: string): PlatformStatusViewLike | null {
    const session = this.sessions.get(shopId);
    if (!session) return null;
    const adapter = this.adapters.get(shopId);
    return {
      shop_id: shopId,
      platform: "pdd",
      session_status: session.state.getStatus(),
      view_visible: session.viewHost?.isVisible ?? false,
      last_error: session.state.getLastError() ?? undefined,
      capabilities: adapter?.capabilities() as Record<string, unknown> | undefined,
    };
  }

  setViewBounds(shopId: string, bounds: ViewBounds, contentBounds: ViewBounds): boolean {
    const session = this.sessions.get(shopId);
    if (!session) return false;
    session.setViewBounds(bounds, contentBounds);
    return true;
  }

  async reload(shopId: string): Promise<boolean> {
    const session = this.sessions.get(shopId);
    if (!session) return false;
    if (this.navigationMode === "FIXTURE") await session.reload(this.options.fixturePathFor?.(shopId));
    else await session.viewHost?.loadProductionEntry(this.options.productionEntryUrl ?? PDD_PRODUCTION_CHAT_URL);
    this.broadcastStatus(shopId);
    return true;
  }

  isTrustedPddWebContents(wc: WebContents): boolean {
    return this.trustedWebContents.has(wc);
  }

  createInboundIngressContext(sender: unknown): PddInboundIngressContext | null {
    const senderObject = asObject(sender);
    if (!senderObject) return null;
    const session = this.senderSessions.get(senderObject);
    if (!session) return null;
    return session.createInboundIngressContext(senderObject);
  }

  handleTrustedInboundIngress(
    sender: unknown,
    context: unknown,
    input: unknown,
    admissionGuard?: () => boolean,
  ): PddInboundIngressResult {
    try {
      return this.handleTrustedInboundIngressInternal(sender, context, input, admissionGuard);
    } catch {
      return { status: "FAILED", reason: "INGRESS_UNEXPECTED_THREW", diagnostics: Object.freeze([]) };
    }
  }

  private handleTrustedInboundIngressInternal(
    sender: unknown,
    context: unknown,
    input: unknown,
    admissionGuard?: () => boolean,
  ): PddInboundIngressResult {
    const senderObject = asObject(sender);
    if (!senderObject) {
      return { status: "REJECTED", reason: "UNTRUSTED_SENDER", diagnostics: Object.freeze([]) };
    }
    const session = this.senderSessions.get(senderObject);
    if (!session) {
      return { status: "REJECTED", reason: "UNTRUSTED_SENDER", diagnostics: Object.freeze([]) };
    }
    const document = session.resolveInboundIngressBinding(context, senderObject);
    if (admissionGuard && !admissionGuard()) {
      return stoppedIngress("MAIN_ADMISSION_INVALIDATED", Object.freeze([]));
    }
    if (!document) {
      return { status: "REJECTED", reason: "INVALID_DOCUMENT_CONTEXT", diagnostics: Object.freeze([]) };
    }
    const resolveScope = this.options.resolveInboundScope;
    if (!resolveScope) {
      return { status: "FAILED", reason: "SCOPE_BINDING_RESOLVER_MISSING", diagnostics: Object.freeze([]) };
    }
    const resolveIdentity = this.options.resolveInboundIdentity;
    if (!resolveIdentity) {
      return { status: "FAILED", reason: "IDENTITY_BINDING_RESOLVER_MISSING", diagnostics: Object.freeze([]) };
    }

    const result = processPddInboundIngress({
      document,
      input,
      resolveScope,
      resolveIdentity,
      canonicalValidator: this.options.canonicalEnvelopeValidator,
    });
    if (result.status !== "MAPPED") return result;

    const currentDocument = session.resolveInboundIngressBinding(context, senderObject);
    if (!currentDocument) {
      return { status: "FAILED", reason: "DOCUMENT_CONTEXT_INVALIDATED", diagnostics: result.diagnostics };
    }
    if (admissionGuard && !admissionGuard()) {
      return stoppedIngress("MAIN_ADMISSION_INVALIDATED", result.diagnostics);
    }
    const collector = this.options.onCanonicalInbound;
    if (!collector) {
      return { status: "STOPPED", reason: "COLLECTOR_MISSING", diagnostics: result.diagnostics };
    }
    let collectorResult: unknown;
    try {
      collectorResult = collector(result.envelope);
    } catch {
      return { status: "FAILED", reason: "COLLECTOR_THREW", diagnostics: result.diagnostics };
    }
    if (isThenable(collectorResult)) {
      try {
        collectorResult.then(() => undefined, () => undefined);
      } catch {
        // The async return is unsupported and is rejected below.
      }
      return { status: "FAILED", reason: "ASYNC_COLLECTOR_UNSUPPORTED", diagnostics: result.diagnostics };
    }
    return result;
  }

  adapterFor(shopId: string): PddPlatformAdapter | null {
    return this.adapters.get(shopId) ?? null;
  }

  /** Main-side diagnostic accessor: the view webContents for a shop (smoke/telemetry). */
  webContentsFor(shopId: string): WebContents | null {
    return this.sessions.get(shopId)?.viewHost?.webContents ?? null;
  }

  /** Dispatcher PlatformAdapter routed by shop (M5 interface). */
  routingAdapter(): PlatformAdapter {
    return {
      sendText: async (shopId: string, conversationId: string, segments: string[]): Promise<SendAttempt> => {
        const adapter = this.adapterFor(shopId);
        if (!adapter && this.sessions.has(shopId)) return { ok: false, error: "platform.command_disabled_navigation_only" };
        if (!adapter) return { ok: false, error: "platform.not_found" };
        return adapter.sendText(shopId, conversationId, segments);
      },
      getCurrentConversationState: async (shopId: string, conversationId: string) => {
        const adapter = this.adapterFor(shopId);
        if (!adapter && this.sessions.has(shopId)) return { hasNewMessage: false };
        if (!adapter) return { hasNewMessage: false };
        return adapter.getCurrentConversationState(shopId, conversationId);
      },
      onTransfer: (decision: TransferDecision) => {
        const shopId = (decision as { shop_id?: string }).shop_id;
        const adapter = shopId ? this.adapterFor(shopId) : null;
        if (!adapter && shopId && this.sessions.has(shopId)) return;
        if (adapter) adapter.onTransfer(decision);
      },
    };
  }

  private broadcastStatus(shopId?: string): void {
    if (!this.options.onStatusChanged) return;
    const revision = this.options.revision?.() ?? 0;
    if (shopId) {
      const status = this.status(shopId);
      if (status) this.options.onStatusChanged({ shop_id: status.shop_id, session_status: status.session_status as PlatformStatusChangedEvent["session_status"], revision, last_error: status.last_error });
      return;
    }
    for (const id of this.sessions.keys()) {
      const status = this.status(id);
      if (status) this.options.onStatusChanged({ shop_id: status.shop_id, session_status: status.session_status as PlatformStatusChangedEvent["session_status"], revision, last_error: status.last_error });
    }
  }

  disposeAll(): void {
    for (const shopId of this.inboundObservers.keys()) this.stopInboundObserver(shopId, "SERVICE_DISPOSED");
    this.admissionRegistry.clear();
    this.connectionAdmissions.clear();
    this.revokedConnectionKeys.clear();
    this.lastAdmissionId = null;
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
    this.bridges.clear();
    this.adapters.clear();
    this.trustedWebContents.clear();
    this.senderSessions.clear();
  }
}
