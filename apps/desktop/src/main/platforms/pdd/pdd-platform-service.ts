// M7 PDD platform service (clean-room). Main-side composition root for the PDD
// vertical slice: per-shop sessions/views, routing PlatformAdapter, page-event
// routing to the orchestrator, status projection.
import type { PlatformAdapter, ConversationOrchestrator, SendAttempt, TransferDecision } from "@fastwork/orchestrator";
import { createHash } from "node:crypto";
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
import { PddInboundObserver, type PddInboundObserverOptions, type PddInboundObserverStartHandle, type PddObservedFrame, type PddHttpRequestBinding, type PddObservedHttpResponse } from "./pdd-inbound-observer.js";
import { createPddDecodedEventAdapter, type PddDecodedEventAdapter, type PddPageEvaluator } from "./pdd-decoded-inbound-event-adapter.js";
import { toInboundEventCandidate } from "./pdd-inbound-event-candidate.js";
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
  /**
   * CONTROLLED decoded-page-event capture. Default OFF: Main owns the switch and the page payload can
   * never enable it. `evaluate` is the Main-side page evaluator (WebContentsView executeJavaScript).
   */
  decodedEventCapture?: {
    readonly enabled: boolean;
    readonly evaluate: PddPageEvaluator;
    readonly maxMessagesPerDrain?: number;
  };
  canonicalEnvelopeValidator?: PddCanonicalEnvelopeValidator | null;
  /** Production default is DISABLED. CANONICAL_CONTROLLED is Main-composed only. */
  canonicalIngressMode?: PddCanonicalIngressMode;
  mainAdmissionProvider?: PddMainAdmissionProvider;
  /** Controlled fixture/loopback frame decoder; production wiring must supply or fail closed. */
  decodeInboundFrame?: (payloadData: string) => PddInboundIngressInput | null;
  /**
   * Trusted-request-start allowlist for HTTP inbound observation. Separate from the
   * WebSocket allowlist on purpose: matching origin + path + method exactly, with no
   * wildcard domain. Undefined disables the HTTP observation path entirely.
   */
  allowedInboundHttpRequest?: (method: string, url: string) => boolean;
  /**
   * Decodes a fully-read HTTP response body into per-message canonical ingress inputs.
   * The returned inputs are still subject to admission and lifecycle re-checks before
   * any collector call. Undefined disables the HTTP observation path entirely.
   */
  decodeInboundHttpBody?: (body: string, binding: PddHttpRequestBinding) => readonly PddInboundIngressInput[] | null;
  /** Local-only allowlist for the controlled observer; no historical Titan URL is enabled implicitly. */
  allowedInboundWebSocketUrl?: (url: string) => boolean;
  /** Diagnostic-only WebSocket frame sink (does not affect canonical admission). */
  onDiagnosticWsFrame?: PddInboundObserverOptions["onDiagnosticWsFrame"];
  /** Test seam for observer lifecycle; controlled smoke must use the real default observer. */
  createInboundObserver?: (options: PddInboundObserverOptions) => PddInboundObserver;
  revision?: () => number;
}

/**
 * True when a navigation promise failed because another navigation superseded it
 * (e.g. a login -> chat redirect). Such an interruption is not a load failure.
 */
/**
 * Session statuses that make canonical inbound capture ineligible. Note that LOADING is
 * deliberately NOT in this list: canonical capture eligibility is independent of the
 * legacy DOM/UI readiness signal. CREATING is handled separately (see the gate).
 */
const CANONICAL_INBOUND_BLOCKED_STATUSES = new Set([
  "LOGIN_REQUIRED",
  "AUTH_REAUTH_REQUIRED",
  "DOM_UNSUPPORTED",
  "ERROR",
  "DISPOSED",
  "STOPPED",
]);

type CanonicalInboundEligibility = { readonly ok: true } | { readonly ok: false; readonly reason: string };
function isNavigationInterruption(error: unknown): boolean {
  const code = (error as { code?: unknown; errno?: unknown } | null)?.code ?? (error as { errno?: unknown } | null)?.errno;
  if (code === -3 || code === "ERR_ABORTED") return true;
  const message = String((error as { message?: unknown } | null)?.message ?? error ?? "");
  return /ERR_ABORTED|net::ERR_ABORTED|-3\b/.test(message);
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
  private activationEpoch = 0;
  private activeViewShopId: string | null = null;
  private readonly sessions = new Map<string, PddSessionHost>();
  /**
   * Controlled decoded-event state per shop. The ledger keeps the SOURCE limitations next to the
   * stored message so that "saved successfully" can never be read as "eligible for automatic reply".
   */
  private readonly decodedEventStates = new Map<string, {
    adapter: PddDecodedEventAdapter;
    ledger: Map<string, { source: "PAGE_DECODED_EVENT"; identityAuthority: "PAYLOAD_SUPPLIED_UNVERIFIED"; newness: "NEWNESS_UNVERIFIED" | "HISTORY_MARKED"; automaticProcessingEligible: false; at: string }>;
    counters: { drained: number; rejectedByGate: number; rejectedByMain: number; ingested: number; duplicates: number; collectorMissing: number; batchLimited: number; dropped: number; gateReasons: Record<string, number> };
  }>();
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
  /** Trusted HTTP request-start evidence, keyed by observer lifecycle + cdpSessionId + requestId. */
  private readonly httpRequestBindings = new Map<string, PddHttpRequestBinding>();
  /** Shops whose current admission was revoked; blocks the HTTP path until re-granted. */
  private readonly revokedShops = new Set<string>();

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

  /** Hide every native view without disposing its owned session or ingress. */
  hideAllViews(): void {
    this.activationEpoch++;
    this.activeViewShopId = null;
    for (const session of this.sessions.values()) session.hide();
  }

  /** Create/load/activate a PDD session; stale loads must not re-show a view. */
  async activate(shopId: string, mayShow: () => boolean = () => true): Promise<void> {
    this.hideAllViews();
    const epoch = this.activationEpoch;
    this.activeViewShopId = shopId;
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
    if (epoch === this.activationEpoch && mayShow()) session.activate();
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
      onDiagnosticWsFrame: this.options.onDiagnosticWsFrame,
      onHttpResponse: (frame) => this.handleObservedHttpResponse(frame),
      allowedHttpRequest: this.options.allowedInboundHttpRequest,
      onHttpRequest: (binding) => { this.httpRequestBindings.set(this.httpBindingKey(binding.connection), binding); },
      onStopped: (reason) => this.handleObserverStopped(shopId, reason),
    };
    return this.options.createInboundObserver?.(options) ?? new PddInboundObserver(options);
  }

  /**
   * Converts a navigation promise into a bounded, non-fatal observation.
   *
   * A real PDD entry can redirect (login -> chat) while loading. That redirect aborts
   * the in-flight navigation promise, which is a normal navigation outcome and must not
   * block readiness or be reported as a load failure. Genuine failures (DNS, TLS,
   * refused, unreachable) still fail closed.
   */
  private async settleNavigationBounded(loadPromise: Promise<unknown>, timeoutMs: number): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const bounded = new Promise<"TIMEOUT">((res) => {
      timeout = setTimeout(() => res("TIMEOUT"), timeoutMs);
    });
    try {
      const outcome = await Promise.race([
        loadPromise.then(() => ({ kind: "LOADED" as const }), (error: unknown) => ({ kind: "REJECTED" as const, error })),
        bounded,
      ]);
      if (outcome === "TIMEOUT") return;
      if (outcome.kind === "REJECTED" && !isNavigationInterruption(outcome.error)) throw outcome.error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async awaitObserverStartup(shopId: string, loadPromise: Promise<unknown>, startup: PddInboundObserverStartHandle | null): Promise<void> {
    if (!startup) {
      await loadPromise;
      return;
    }
    // Observer readiness, not navigation settlement, decides session readiness. The
    // entry navigation is observed as a bounded side condition so a login->chat redirect
    // cannot wedge the session in CREATING.
    const ownsStartup = () => this.observerStartups.get(shopId) === startup;
    // Observer enablement is the readiness gate; attach / Network.enable failures fail closed.
    await startup.enablePromise;
    if (!ownsStartup()) throw new Error("inbound observer startup superseded");
    // Then give the entry navigation a short bounded window so a genuine load failure is
    // still surfaced, while a redirect-aborted navigation is treated as a normal outcome.
    await this.settleNavigationBounded(loadPromise, 3000);
    if (!ownsStartup()) throw new Error("inbound observer startup superseded");
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

  /**
   * HTTP inbound observation: a response body is only usable when a trusted
   * request-start binding exists for the same observer lifecycle, CDP sessionId and
   * requestId, AND the live session/document still matches. The body is decoded only
   * after those checks; admission is then granted/invalidated and re-checked before and
   * after mapping, exactly like the WebSocket path. No legacy fallback, no retry.
   */
  /**
   * Main-only canonical inbound capture eligibility.
   *
   * This gate proves the request is attributable to a trusted, current, still-valid
   * Main-observed document for this shop. It deliberately does NOT change session UI
   * state and never promotes LOADING to READY: the legacy page_ready signal keeps its
   * own meaning, while canonical capture has its own eligibility.
   *
   * LOADING is acceptable here; CREATING (no trusted document generation yet), any
   * login/reauth/unsupported/error/disposed state, a stale binding, a disallowed route
   * and an invalid or missing admission are all rejected.
   */
  private canAcceptCanonicalInbound(
    connection: PddConnectionEvidence,
    binding: PddInboundDocumentBinding,
    admission?: { readonly admissionId: string; readonly request: PddMainAdmissionRequest },
  ): CanonicalInboundEligibility {
    if (this.canonicalIngressMode !== "CANONICAL_CONTROLLED") return { ok: false, reason: "MODE_NOT_CONTROLLED" };
    if (!this.trustedWebContents.has(connection.webContents)) return { ok: false, reason: "WEBCONTENTS_NOT_TRUSTED" };
    if (this.webContentsFor(connection.shopId) !== connection.webContents) return { ok: false, reason: "WEBCONTENTS_MISMATCH" };
    const observer = this.inboundObservers.get(connection.shopId);
    if (
      !observer ||
      observer.isTerminal ||
      !observer.isEnabled ||
      observer.targetWebContents !== connection.webContents ||
      observer.activeLifecycleId !== connection.observerLifecycleId
    ) {
      return { ok: false, reason: "OBSERVER_NOT_ELIGIBLE" };
    }
    const session = this.senderSessions.get(connection.webContents as object);
    if (!session) return { ok: false, reason: "SESSION_NOT_FOUND" };
    const status = session.state.getStatus();
    if (CANONICAL_INBOUND_BLOCKED_STATUSES.has(status)) return { ok: false, reason: "SESSION_STATUS_" + status };
    if (status === "CREATING") return { ok: false, reason: "SESSION_CREATING_NO_DOCUMENT" };
    const current = session.getCurrentInboundDocumentBinding();
    if (!current) return { ok: false, reason: "DOCUMENT_BINDING_ABSENT" };
    if (!this.sameConnectionBinding(connection, current)) return { ok: false, reason: "DOCUMENT_BINDING_MISMATCH" };
    if (
      binding.sessionId !== current.sessionId ||
      binding.shopId !== current.shopId ||
      binding.documentGeneration !== current.documentGeneration
    ) {
      return { ok: false, reason: "SUPPLIED_BINDING_MISMATCH" };
    }
    const route = session.viewHost?.currentRouteKind;
    if (route === "LOGIN" || route === "BLOCKED") return { ok: false, reason: "ROUTE_" + route };
    if (admission) {
      if (this.revokedConnectionKeys.has(this.httpBindingKey(connection)) || this.revokedShops.has(connection.shopId)) {
        return { ok: false, reason: "ADMISSION_REVOKED" };
      }
      if (!this.admissionRegistry.validate(admission.admissionId, admission.request)) {
        return { ok: false, reason: "ADMISSION_INVALID" };
      }
    }
    return { ok: true };
  }
  private handleObservedHttpResponse(frame: PddObservedHttpResponse): void {
    const binding = frame.binding;
    const connection = binding.connection;
    const key = this.httpBindingKey(connection);
    const recorded = this.httpRequestBindings.get(key);
    if (!recorded) {
      this.recordInboundDecision("HTTP_UNBOUND_RESPONSE");
      return;
    }
    this.httpRequestBindings.delete(key);
    if (this.canonicalIngressMode !== "CANONICAL_CONTROLLED") {
      this.recordInboundDecision("CANONICAL_INGRESS_DISABLED");
      return;
    }
    const observer = this.inboundObservers.get(connection.shopId);
    if (!observer || observer.isTerminal || observer.activeLifecycleId !== connection.observerLifecycleId) {
      this.recordInboundDecision("HTTP_OBSERVER_STALE_OR_TERMINAL");
      return;
    }
    if (this.webContentsFor(connection.shopId) !== connection.webContents) {
      this.recordInboundDecision("HTTP_WEBCONTENTS_MISMATCH");
      return;
    }
    const session = this.senderSessions.get(connection.webContents as object);
    if (!session) {
      this.recordInboundDecision("HTTP_SESSION_NOT_READY");
      return;
    }
    const currentBinding = session.getCurrentInboundDocumentBinding();
    if (!currentBinding) {
      this.recordInboundDecision("HTTP_DOCUMENT_BINDING_ABSENT");
      return;
    }
    // Canonical capture eligibility is independent of the legacy DOM/UI READY signal.
    const eligibility = this.canAcceptCanonicalInbound(connection, currentBinding);
    if (!eligibility.ok) {
      this.recordInboundDecision("HTTP_CANONICAL_NOT_ELIGIBLE:" + eligibility.reason);
      return;
    }
    if (frame.status < 200 || frame.status >= 300) {
      this.recordInboundDecision("HTTP_STATUS_NOT_OK");
      return;
    }
    const decoder = this.options.decodeInboundHttpBody;
    if (!decoder) {
      this.recordInboundDecision("HTTP_DECODER_MISSING");
      return;
    }
    let inputs: readonly PddInboundIngressInput[] | null;
    try {
      inputs = decoder(frame.body, binding);
    } catch {
      this.recordInboundDecision("HTTP_DECODER_THREW");
      return;
    }
    if (!inputs || inputs.length === 0) {
      this.recordInboundDecision("HTTP_DECODER_NO_CANDIDATES");
      return;
    }
    for (const input of inputs) {
      const liveSession = this.senderSessions.get(connection.webContents as object);
      if (!liveSession) {
        this.recordInboundDecision("HTTP_SESSION_INVALIDATED");
        return;
      }
      const liveBinding = liveSession.getCurrentInboundDocumentBinding();
      if (!liveBinding) {
        this.recordInboundDecision("HTTP_BINDING_INVALIDATED");
        return;
      }
      const liveEligibility = this.canAcceptCanonicalInbound(connection, liveBinding);
      if (!liveEligibility.ok) {
        this.recordInboundDecision("HTTP_CANONICAL_NOT_ELIGIBLE:" + liveEligibility.reason);
        return;
      }
      const context = liveSession.createCanonicalInboundIngressContext(connection.webContents);
      if (!context) {
        this.recordInboundDecision("HTTP_INVALID_DOCUMENT_CONTEXT");
        return;
      }
      const request: PddMainAdmissionRequest = { webContents: connection.webContents, connection, binding: liveBinding };
      if (this.revokedConnectionKeys.has(key) || this.revokedShops.has(connection.shopId)) {
        this.recordInboundDecision("MAIN_ADMISSION_REVOKED");
        return;
      }
      let admissionId = this.connectionAdmissions.get(key);
      if (!admissionId || !this.admissionRegistry.validate(admissionId, request)) {
        const admission = this.admissionRegistry.evaluate(request);
        if (!admission.granted) {
          this.recordInboundDecision("MAIN_ADMISSION_DENIED:" + admission.reason);
          return;
        }
        admissionId = admission.admissionId;
        this.connectionAdmissions.set(key, admissionId);
        this.lastAdmissionId = admissionId;
        this.revokedShops.delete(connection.shopId);
      }
      const preCollector = this.canAcceptCanonicalInbound(connection, liveBinding, { admissionId, request });
      if (!preCollector.ok) {
        this.recordInboundDecision("HTTP_CANONICAL_NOT_ELIGIBLE:" + preCollector.reason);
        return;
      }
      const result = this.handleAdmittedInboundIngress(connection.webContents, context, admissionId, input, request, { canonical: true });
      this.recordInboundDecision(result.status === "MAPPED" ? "HTTP_MAPPED" : "HTTP_" + result.status + ":" + result.reason);
      if (result.status !== "MAPPED") return;
    }
  }

  private httpBindingKey(connection: Pick<PddConnectionEvidence, "observerId" | "observerLifecycleId" | "cdpSessionId" | "requestId">): string {
    return [connection.observerId, connection.observerLifecycleId, connection.cdpSessionId, connection.requestId].join("|");
  }
  revokeMainAdmissionsForShop(shopId: string): number {
    this.revokedShops.add(shopId);
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
    options?: { readonly canonical?: boolean },
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
    }, options);
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
    if (!session || this.activeViewShopId !== shopId) return false;
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
    options?: { readonly canonical?: boolean },
  ): PddInboundIngressResult {
    try {
      return this.handleTrustedInboundIngressInternal(sender, context, input, admissionGuard, options);
    } catch {
      return { status: "FAILED", reason: "INGRESS_UNEXPECTED_THREW", diagnostics: Object.freeze([]) };
    }
  }

  private handleTrustedInboundIngressInternal(
    sender: unknown,
    context: unknown,
    input: unknown,
    admissionGuard?: () => boolean,
    options?: { readonly canonical?: boolean },
  ): PddInboundIngressResult {
    const senderObject = asObject(sender);
    if (!senderObject) {
      return { status: "REJECTED", reason: "UNTRUSTED_SENDER", diagnostics: Object.freeze([]) };
    }
    const session = this.senderSessions.get(senderObject);
    if (!session) {
      return { status: "REJECTED", reason: "UNTRUSTED_SENDER", diagnostics: Object.freeze([]) };
    }
    const document = options?.canonical
      ? session.resolveCanonicalInboundIngressBinding(context, senderObject)
      : session.resolveInboundIngressBinding(context, senderObject);
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

    const currentDocument = options?.canonical
      ? session.resolveCanonicalInboundIngressBinding(context, senderObject)
      : session.resolveInboundIngressBinding(context, senderObject);
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

  /** Main owns the decoded-event capture switch; the page can never enable it. */
  /**
   * Main admission for the page-decoded-event path. It uses the SAME registry and the SAME request
   * contract as the observer path (webContents + connection evidence + document binding) and has its
   * own revocation set. Document identity is checked separately and cannot stand in for admission.
   */
  private evaluateDecodedEventAdmission(shopId: string, session: PddSessionHost | undefined): { granted: boolean; reason: string } {
    if (!this.options.mainAdmissionProvider) return { granted: false, reason: "MAIN_ADMISSION_PROVIDER_MISSING" };
    const binding = session ? session.resolveActiveCanonicalDocumentBinding() : null;
    if (!binding) return { granted: false, reason: "DOCUMENT_BINDING_UNAVAILABLE" };
    if (this.revokedShops.has(shopId)) return { granted: false, reason: "MAIN_ADMISSION_REVOKED" };
    const webContents = this.webContentsFor(shopId);
    if (!webContents) return { granted: false, reason: "MAIN_ADMISSION_PAGE_MISSING" };
    const connection: PddConnectionEvidence = Object.freeze({
      webContents,
      observerId: "page-decoded-event",
      observerLifecycleId: 0,
      sessionId: binding.sessionId,
      shopId: binding.shopId,
      documentGeneration: binding.documentGeneration,
      cdpSessionId: "",
      requestId: "page-decoded-event",
      url: PDD_PRODUCTION_CHAT_URL,
    });
    try {
      const decision = this.admissionRegistry.evaluate({ webContents, connection, binding });
      if (!decision || decision.granted !== true) return { granted: false, reason: "MAIN_ADMISSION_DENIED:" + String((decision as { reason?: unknown })?.reason ?? "UNKNOWN") };
      return { granted: true, reason: "GRANTED" };
    } catch {
      return { granted: false, reason: "MAIN_ADMISSION_THREW" };
    }
  }

  async startDecodedEventCapture(shopId: string): Promise<{ ok: boolean; reason?: string }> {
    const config = this.options.decodedEventCapture;
    if (!config || config.enabled !== true) return { ok: false, reason: "DECODED_EVENT_CAPTURE_DISABLED" };
    if (!this.options.onCanonicalInbound) return { ok: false, reason: "COLLECTOR_MISSING" };
    if (this.decodedEventStates.has(shopId)) return { ok: true };
    const adapter = createPddDecodedEventAdapter({
      enabled: true,
      evaluate: config.evaluate,
      document: () => this.sessions.get(shopId)?.resolveActiveCanonicalDocumentBinding() ?? { sessionId: "", shopId, documentGeneration: -1 },
      ...(config.maxMessagesPerDrain === undefined ? {} : { maxMessagesPerDrain: config.maxMessagesPerDrain }),
    });
    const installed = await adapter.install();
    if (!installed.ok) return { ok: false, reason: installed.reason ?? "INSTALL_FAILED" };
    this.decodedEventStates.set(shopId, {
      adapter,
      ledger: new Map(),
      counters: { drained: 0, rejectedByGate: 0, rejectedByMain: 0, ingested: 0, duplicates: 0, collectorMissing: 0, batchLimited: 0, dropped: 0, gateReasons: {} },
    });
    return { ok: true };
  }

  async drainDecodedEvents(shopId: string): Promise<{ ok: boolean; reason?: string; drained: number; ingested: number; duplicates: number; remaining: number; dropped: number; gap: boolean; diagnostics: readonly string[] }> {
    const empty = { drained: 0, ingested: 0, duplicates: 0, remaining: 0, dropped: 0, gap: false, diagnostics: [] as string[] };
    const state = this.decodedEventStates.get(shopId);
    if (!state) return { ok: false, reason: "DECODED_EVENT_CAPTURE_NOT_STARTED", ...empty };
    const session = this.sessions.get(shopId);
    // ALL release/identity checks happen BEFORE the collector: (1) Main admission (when this path has
    // one), (2) the live document binding. Nothing is drained, mapped, collected or written otherwise.
    // Admission is REQUIRED for this path: a missing provider refuses, it is not "check only if set".
    const admissionBefore = this.evaluateDecodedEventAdmission(shopId, session);
    if (!admissionBefore.granted) return { ok: false, reason: admissionBefore.reason, ...empty };
    if (!session || !session.resolveActiveCanonicalDocumentBinding()) {
      return { ok: false, reason: "DOCUMENT_BINDING_UNAVAILABLE", ...empty };
    }
    const drained = await state.adapter.drain();
    if (!drained.ok) return { ok: false, reason: drained.reason ?? "DRAIN_FAILED", ...empty };
    // Admission is re-evaluated AFTER the async drain and BEFORE any collector call: a revocation that
    // happened while draining must stop everything (the document binding alone cannot authorise it).
    const admissionAfter = this.evaluateDecodedEventAdmission(shopId, session);
    if (!admissionAfter.granted) {
      return { ok: false, reason: admissionAfter.reason, ...empty, drained: drained.messages.length, diagnostics: [...drained.diagnostics, "ADMISSION_REVOKED_DURING_DRAIN"] };
    }

    const diagnostics: string[] = [...drained.diagnostics];
    const resolveScope = this.options.resolveInboundScope;
    const resolveIdentity = this.options.resolveInboundIdentity;
    let ingested = 0;
    let duplicates = 0;
    for (const entry of drained.messages) {
      state.counters.drained += 1;
      const message = (entry as { message?: unknown }).message;
      const candidate = toInboundEventCandidate(message);
      if (candidate.status !== "CANDIDATE") {
        state.counters.rejectedByGate += 1;
        state.counters.gateReasons[candidate.reason] = (state.counters.gateReasons[candidate.reason] ?? 0) + 1;
        continue;
      }
      // Identity comes from Main only: live view + non-blocked status + CURRENT document generation.
      const binding = session ? session.resolveActiveCanonicalDocumentBinding() : null;
      if (!binding) { state.counters.rejectedByMain += 1; diagnostics.push("DOCUMENT_BINDING_UNAVAILABLE"); continue; }
      if (!resolveScope || !resolveIdentity) { state.counters.rejectedByMain += 1; diagnostics.push("BINDING_RESOLVER_MISSING"); continue; }
      const result = processPddInboundIngress({
        document: binding,
        input: candidate.ingressInput,
        resolveScope,
        resolveIdentity,
        canonicalValidator: this.options.canonicalEnvelopeValidator,
      });
      if (result.status !== "MAPPED") { state.counters.rejectedByMain += 1; diagnostics.push("INGRESS_" + result.status + (result.reason ? "_" + result.reason : "")); continue; }
      // A document replacement between mapping and collection must refuse the event (late callback).
      const after = session ? session.resolveActiveCanonicalDocumentBinding() : null;
      if (!after || after.sessionId !== binding.sessionId || after.shopId !== binding.shopId || after.documentGeneration !== binding.documentGeneration) {
        state.counters.rejectedByMain += 1;
        diagnostics.push("DOCUMENT_CONTEXT_INVALIDATED");
        continue;
      }
      const collector = this.options.onCanonicalInbound;
      if (!collector) { state.counters.collectorMissing += 1; diagnostics.push("COLLECTOR_MISSING"); continue; }
      let collected: unknown;
      try { collected = collector(result.envelope); } catch { state.counters.rejectedByMain += 1; diagnostics.push("COLLECTOR_THREW"); continue; }
      const identity = result.envelope.identityLock.triggerMessage.platformMessageIdentity;
      const messageId = identity.provenance === "UNKNOWN" ? "unknown" : String(identity.value);
      state.ledger.set(messageId, {
        source: "PAGE_DECODED_EVENT",
        identityAuthority: "PAYLOAD_SUPPLIED_UNVERIFIED",
        newness: (message as { is_history?: unknown })?.is_history === true ? "HISTORY_MARKED" : "NEWNESS_UNVERIFIED",
        automaticProcessingEligible: false,
        at: new Date().toISOString(),
      });
      const status = collected && typeof collected === "object" && "status" in (collected as object) ? String((collected as { status?: unknown }).status) : "UNKNOWN";
      if (status === "INGESTED") { state.counters.ingested += 1; ingested += 1; }
      else if (status === "DUPLICATE") { state.counters.duplicates += 1; duplicates += 1; }
    }
    const remainingEntry = diagnostics.find((entry) => entry.startsWith("BATCH_LIMIT_REACHED_REMAINING_"));
    const remaining = remainingEntry ? Number(remainingEntry.split("_").pop()) : 0;
    if (remaining > 0) state.counters.batchLimited += 1;
    if (drained.dropped > 0) state.counters.dropped += drained.dropped;
    return { ok: true, drained: drained.messages.length, ingested, duplicates, remaining, dropped: drained.dropped, gap: drained.dropped > 0, diagnostics };
  }

  async stopDecodedEventCapture(shopId: string): Promise<{ ok: boolean; reason?: string }> {
    const state = this.decodedEventStates.get(shopId);
    if (!state) return { ok: false, reason: "DECODED_EVENT_CAPTURE_NOT_STARTED" };
    const result = await state.adapter.unload();
    this.decodedEventStates.delete(shopId);
    return result;
  }

  /** Source limitations preserved next to each stored page-event message (never auto-processing). */
  decodedEventDiagnostics(shopId: string): { installed: boolean; counters: unknown; ledgerSize: number; ledger: ReadonlyArray<{ messageIdSha8: string; entry: unknown }> } | null {
    const state = this.decodedEventStates.get(shopId);
    if (!state) return null;
    const ledger = [...state.ledger.entries()].slice(0, 200).map(([messageId, entry]) => ({ messageIdSha8: createHash("sha256").update(messageId).digest("hex").slice(0, 12), entry }));
    return { installed: state.adapter.state() === "INSTALLED", counters: { ...state.counters, gateReasons: { ...state.counters.gateReasons } }, ledgerSize: state.ledger.size, ledger };
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
    this.hideAllViews();
    for (const shopId of this.inboundObservers.keys()) this.stopInboundObserver(shopId, "SERVICE_DISPOSED");
    this.admissionRegistry.clear();
    this.connectionAdmissions.clear();
    this.revokedConnectionKeys.clear();
    this.httpRequestBindings.clear();
    this.revokedShops.clear();
    this.lastAdmissionId = null;
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
    this.bridges.clear();
    this.adapters.clear();
    this.trustedWebContents.clear();
    this.senderSessions.clear();
  }
}
