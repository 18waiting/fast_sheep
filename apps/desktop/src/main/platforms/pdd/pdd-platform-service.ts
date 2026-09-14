// M7 PDD platform service (clean-room). Main-side composition root for the PDD
// vertical slice: per-shop sessions/views, routing PlatformAdapter, page-event
// routing to the orchestrator, status projection.
import type { PlatformAdapter, ConversationOrchestrator, SendAttempt, TransferDecision } from "@fastwork/orchestrator";
import type { PddPageEvent, PddPageCommandResult } from "@fastwork/platform-pdd";
import { PddPlatformAdapter } from "@fastwork/platform-pdd";
import type { PlatformStatusChangedEvent } from "@fastwork/desktop-ipc";
import type { WebContents } from "electron";
import { PddSessionHost } from "./pdd-session-host.js";
import { PddViewHost, type ViewBounds } from "./pdd-view-host.js";
import { PddPreloadBridge } from "./pdd-preload-bridge.js";
import { PddOrchestratorBridge, type PddInboundMessage } from "./pdd-orchestrator-bridge.js";
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
  revision?: () => number;
}

export class PddPlatformService {
  private readonly sessions = new Map<string, PddSessionHost>();
  private readonly bridges = new Map<string, PddPreloadBridge>();
  private readonly adapters = new Map<string, PddPlatformAdapter>();
  private readonly trustedWebContents = new Set<WebContents>();
  private readonly orchestratorBridge: PddOrchestratorBridge;
  private readonly options: PddPlatformServiceOptions;
  private readonly navigationMode: PddNavigationMode;

  constructor(options: PddPlatformServiceOptions) {
    if (options.navigationMode !== "FIXTURE" && options.navigationMode !== "PRODUCTION_READ_ONLY") {
      throw new Error("navigationMode is required");
    }
    this.options = options;
    this.navigationMode = options.navigationMode;
    this.orchestratorBridge = new PddOrchestratorBridge(options.orchestrator);
  }

  /** PDD page event from the trusted page preload. */
  handlePageEvent(payload: unknown): void {
    let ev = payload as PddPageEvent;
    const session = ev.session_id ? this.sessionBySessionId(ev.session_id) : undefined;
    if (session?.viewHost?.currentRouteKind === "LOGIN" && ev.event === "page_ready") {
      ev = { ...ev, event: "login_required" };
    }
    if (session) session.handleEvent(ev);
    else {
      // Locate by shop if session id mapping is unavailable.
      for (const s of this.sessions.values()) {
        if (s.state.shopId === ev.shop_id) { s.handleEvent(ev); break; }
      }
    }

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
    this.broadcastStatus(ev.shop_id);
  }

  handleCommandResult(payload: unknown): void {
    const result = payload as PddPageCommandResult;
    for (const bridge of this.bridges.values()) bridge.resolveResult(result);
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
        },
      });
      this.sessions.set(shopId, session);
      await session.createAndLoad(fixturePath);
      if (this.navigationMode === "PRODUCTION_READ_ONLY") {
        if (!session.viewHost) throw new Error("production PDD view was not created");
        try {
          await session.viewHost.loadProductionEntry(this.options.productionEntryUrl ?? PDD_PRODUCTION_CHAT_URL);
        } catch (error) {
          session.handleEvent({ event: "dom_unsupported", session_id: session.state.sessionId, shop_id: shopId, reason: "PRODUCTION_ENTRY_CONFIG_INVALID" } as PddPageEvent);
          throw error;
        }
      }
    }
    session.activate();
    this.broadcastStatus(shopId);
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
    this.broadcastStatus(shopId);
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
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
    this.bridges.clear();
    this.adapters.clear();
    this.trustedWebContents.clear();
  }
}
