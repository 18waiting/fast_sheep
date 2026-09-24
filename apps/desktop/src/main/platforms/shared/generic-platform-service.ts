// M8 generic platform service (clean-room). Per-shop sessions/views/adapters for
// one web platform, routing page events to the orchestrator.
import type { PlatformAdapter, ConversationOrchestrator, SendAttempt, TransferDecision } from "@fastwork/orchestrator";
import type { PlatformPageEvent, PlatformPageCommandResult, PlatformCapabilities, SelectorProfile } from "@fastwork/platform-web-common";
import { createPlatformAdapter, type GenericPlatformAdapter, type PlatformPageBridge, type PlatformPageCommand } from "@fastwork/platform-web-common";
import type { WebContents } from "electron";
import { GenericPlatformSession } from "./generic-session.js";
import { GenericPreloadBridge } from "./generic-session.js";
import { GenericOrchestratorBridge } from "./generic-session.js";
import { GenericViewHost } from "./generic-view-host.js";

export interface GenericPlatformServiceOptions {
  platform: string;
  testMode: boolean;
  orchestrator: ConversationOrchestrator;
  capabilities: PlatformCapabilities;
  allowedProductionHosts?: readonly string[];
  preloadPath: string;
  commandChannel: string;
  fixturePathFor?: (shopId: string) => string | undefined;
  makeView?: (shopId: string, testMode: boolean) => GenericViewHost;
  onStatusChanged?: (ev: { shop_id: string; session_status: string; revision: number; last_error?: string }) => void;
  onInboundMessage?: (message: { shop_id: string; conversation_id: string; content: string; buyer?: string; buyer_id?: string; platform_message_id?: string; timestamp?: string }) => Promise<void>;
  onHumanReply?: (shopId: string, conversationId: string) => Promise<void>;
  onConversationChange?: (shopId: string) => void;
  revision?: () => number;
}

export class GenericPlatformService {
  private activationEpoch = 0;
  private activeViewShopId: string | null = null;
  private readonly sessions = new Map<string, GenericPlatformSession>();
  private readonly bridges = new Map<string, GenericPreloadBridge>();
  private readonly adapters = new Map<string, GenericPlatformAdapter>();
  private readonly trustedWebContents = new Set<WebContents>();
  private readonly orchestratorBridge: GenericOrchestratorBridge;

  constructor(private readonly options: GenericPlatformServiceOptions) {
    this.orchestratorBridge = new GenericOrchestratorBridge(options.orchestrator);
  }

  handlePageEvent(payload: unknown): void {
    const ev = payload as PlatformPageEvent;
    const session = this.sessionBySessionId(ev.session_id);
    if (session) session.handleEvent(ev);
    else for (const s of this.sessions.values()) { if (s.state.shopId === ev.shop_id) { s.handleEvent(ev); break; } }

    if (ev.event === "message_received" && ev.shop_id && ev.conversation_id && ev.content !== undefined) {
      void this.handleInbound({ shop_id: ev.shop_id, conversation_id: ev.conversation_id, buyer_id: ev.buyer_id, buyer: ev.buyer, platform_message_id: ev.platform_message_id, content: ev.content, timestamp: ev.timestamp });
    } else if (ev.event === "human_reply_detected" && ev.shop_id && ev.conversation_id) {
      void this.handleHumanReply(ev.shop_id, ev.conversation_id);
    } else if (ev.event === "conversation_changed" && ev.shop_id) {
      this.handleConversationChange(ev.shop_id);
    }
    this.broadcastStatus(ev.shop_id);
  }

  handleCommandResult(payload: unknown): void {
    const result = payload as PlatformPageCommandResult;
    for (const bridge of this.bridges.values()) bridge.resolveResult(result);
  }

  private sessionBySessionId(sessionId: string): GenericPlatformSession | undefined {
    for (const s of this.sessions.values()) if (s.state.sessionId === sessionId) return s;
    return undefined;
  }

  private async handleInbound(message: { shop_id: string; conversation_id: string; content: string; buyer?: string; buyer_id?: string; platform_message_id?: string; timestamp?: string }): Promise<void> {
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

  hideAllViews(): void {
    this.activationEpoch++;
    this.activeViewShopId = null;
    for (const session of this.sessions.values()) session.hide();
  }

  async activate(shopId: string, mayShow: () => boolean = () => true): Promise<void> {
    this.hideAllViews();
    const epoch = this.activationEpoch;
    this.activeViewShopId = shopId;
    let session = this.sessions.get(shopId);
    if (!session) {
      const fixturePath = this.options.fixturePathFor?.(shopId);
      const makeView = this.options.makeView ?? ((sid: string, testMode: boolean) => new GenericViewHost({ platform: this.options.platform, shopId: sid, testMode, preloadPath: this.options.preloadPath, allowedProductionHosts: this.options.allowedProductionHosts }));
      const self = this;
      session = new GenericPlatformSession({
        platform: this.options.platform,
        shopId,
        makeView: () => makeView(shopId, this.options.testMode),
        onEvent: (ev) => this.onSessionEvent(shopId, ev),
        onViewCreated: (view) => {
          self.trustedWebContents.add(view.webContents);
          const bridge = new GenericPreloadBridge(view, self.options.commandChannel);
          self.bridges.set(shopId, bridge);
          const bridge2: PlatformPageBridge = { execute: (cmd: PlatformPageCommand) => bridge.execute(cmd) };
          const adapter = createPlatformAdapter({ platform: self.options.platform, bridge: bridge2, session: session!.state, capabilities: self.options.capabilities });
          self.adapters.set(shopId, adapter);
        },
      });
      this.sessions.set(shopId, session);
      await session.createAndLoad(fixturePath);
    }
    if (epoch === this.activationEpoch && mayShow()) session.activate();
    this.broadcastStatus(shopId);
  }

  private onSessionEvent(shopId: string, ev: PlatformPageEvent): void {
    void ev;
    this.broadcastStatus(shopId);
  }

  status(shopId: string): { shop_id: string; platform: string; session_status: string; view_visible: boolean; last_error?: string; capabilities?: Record<string, unknown> } | null {
    const session = this.sessions.get(shopId);
    if (!session) return null;
    const adapter = this.adapters.get(shopId);
    return {
      shop_id: shopId,
      platform: this.options.platform,
      session_status: session.state.getStatus(),
      view_visible: session.viewHost?.isVisible ?? false,
      last_error: session.state.getLastError() ?? undefined,
      capabilities: adapter?.capabilities() as Record<string, unknown> | undefined,
    };
  }

  setViewBounds(shopId: string, bounds: { x: number; y: number; width: number; height: number; visible: boolean }, content: { x: number; y: number; width: number; height: number; visible: boolean }): boolean {
    const session = this.sessions.get(shopId);
    if (!session || this.activeViewShopId !== shopId) return false;
    session.setViewBounds(bounds, content);
    this.broadcastStatus(shopId);
    return true;
  }

  async reload(shopId: string): Promise<boolean> {
    const session = this.sessions.get(shopId);
    if (!session) return false;
    await session.reload(this.options.fixturePathFor?.(shopId));
    this.broadcastStatus(shopId);
    return true;
  }

  isTrustedWebContents(wc: WebContents): boolean {
    return this.trustedWebContents.has(wc);
  }

  adapterFor(shopId: string): GenericPlatformAdapter | null {
    return this.adapters.get(shopId) ?? null;
  }

  webContentsFor(shopId: string): WebContents | null {
    return this.sessions.get(shopId)?.viewHost?.webContents ?? null;
  }

  routingAdapter(): PlatformAdapter {
    return {
      sendText: async (shopId: string, conversationId: string, segments: string[]): Promise<SendAttempt> => {
        const adapter = this.adapterFor(shopId);
        if (!adapter) return { ok: false, error: "platform.not_found" };
        return adapter.sendText(shopId, conversationId, segments);
      },
      getCurrentConversationState: async (shopId: string, conversationId: string) => {
        const adapter = this.adapterFor(shopId);
        if (!adapter) return { hasNewMessage: false };
        return (await adapter.getCurrentConversationState?.(shopId, conversationId)) ?? { hasNewMessage: false };
      },
      onTransfer: (decision: TransferDecision) => {
        const shopId = (decision as { shop_id?: string }).shop_id;
        const adapter = shopId ? this.adapterFor(shopId) : null;
        adapter?.onTransfer?.(decision);
      },
    };
  }

  private broadcastStatus(shopId?: string): void {
    const onStatusChanged = this.options.onStatusChanged;
    const revision = this.options.revision?.() ?? 0;
    const emit = (id: string): void => {
      const status = this.status(id);
      if (status && onStatusChanged) onStatusChanged({ shop_id: status.shop_id, session_status: status.session_status, revision, last_error: status.last_error });
    };
    if (shopId) emit(shopId);
    else for (const id of this.sessions.keys()) emit(id);
  }

  disposeAll(): void {
    this.hideAllViews();
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
    this.bridges.clear();
    this.adapters.clear();
    this.trustedWebContents.clear();
  }
}

