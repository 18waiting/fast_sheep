// M8 generic platform session + preload bridge + orchestrator bridge.
import type { PlatformPageEvent, PlatformPageCommand, PlatformPageCommandResult } from "@fastwork/platform-web-common";
import { PlatformSessionState } from "@fastwork/platform-web-common";
import type { ConversationOrchestrator, BuyerMessage } from "@fastwork/orchestrator";
import type { GenericViewHost } from "./generic-view-host.js";

export interface GenericSessionOptions {
  platform: string;
  shopId: string;
  makeView: () => GenericViewHost;
  onEvent?: (ev: PlatformPageEvent) => void;
  onViewCreated?: (view: GenericViewHost) => void;
}

export class GenericPlatformSession {
  readonly state: PlatformSessionState;
  private view: GenericViewHost | null = null;
  private readonly onEventHook: ((ev: PlatformPageEvent) => void) | undefined;
  private readonly onViewCreatedHook: ((view: GenericViewHost) => void) | undefined;

  constructor(options: GenericSessionOptions) {
    this.state = new PlatformSessionState(options.platform, options.shopId, options.platform + "-session-" + options.shopId);
    this.makeView = options.makeView;
    this.onEventHook = options.onEvent;
    this.onViewCreatedHook = options.onViewCreated;
    this.state.setStatus("STOPPED");
  }

  private readonly makeView: () => GenericViewHost;

  get viewHost(): GenericViewHost | null {
    return this.view;
  }

  async createAndLoad(fixturePath?: string): Promise<void> {
    this.state.setStatus("CREATING");
    this.view = this.makeView();
    this.onViewCreatedHook?.(this.view);
    if (fixturePath) {
      this.state.setStatus("LOADING");
      await this.view.loadLocalFixture(fixturePath, { shop_id: this.state.shopId, session_id: this.state.sessionId });
    }
  }

  activate(): void { this.view?.show(); }
  hide(): void { this.view?.hide(); }
  setViewBounds(bounds: { x: number; y: number; width: number; height: number; visible: boolean }, content: { x: number; y: number; width: number; height: number; visible: boolean }): void {
    this.view?.setBounds(bounds, content);
  }
  async reload(fixturePath?: string): Promise<void> {
    if (fixturePath && this.view) await this.view.loadLocalFixture(fixturePath, { shop_id: this.state.shopId, session_id: this.state.sessionId });
  }

  handleEvent(ev: PlatformPageEvent): void {
    if (ev.event === "page_ready") this.state.setStatus("READY");
    else if (ev.event === "login_required") this.state.setStatus("LOGIN_REQUIRED");
    else if (ev.event === "dom_unsupported") this.state.setStatus("DOM_UNSUPPORTED", ev.reason ?? "DOM_UNSUPPORTED");
    else if (ev.event === "conversation_changed" && ev.conversation_id) this.state.setConversation(ev.conversation_id, ev.buyer_id);
    this.onEventHook?.(ev);
  }

  dispose(): void {
    this.view?.dispose();
    this.view = null;
    this.state.setStatus("DISPOSED");
  }
}

export interface PendingCommand {
  resolve(result: PlatformPageCommandResult): void;
  timer: ReturnType<typeof setTimeout>;
}

export class GenericPreloadBridge {
  private readonly pending = new Map<string, PendingCommand>();
  constructor(private readonly view: GenericViewHost, private readonly commandChannel: string, private readonly timeoutMs = 8000) {}

  execute(command: PlatformPageCommand): Promise<PlatformPageCommandResult> {
    return new Promise<PlatformPageCommandResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.command_id);
        resolve({ command_id: command.command_id, ok: false, error: "platform.command_timeout" });
      }, this.timeoutMs);
      this.pending.set(command.command_id, { resolve, timer });
      if (this.view.webContents.isDestroyed()) {
        clearTimeout(timer);
        this.pending.delete(command.command_id);
        resolve({ command_id: command.command_id, ok: false, error: "platform.session_error" });
        return;
      }
      this.view.webContents.send(this.commandChannel, command);
    });
  }

  resolveResult(result: PlatformPageCommandResult): void {
    const p = this.pending.get(result.command_id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(result.command_id);
    p.resolve(result);
  }

  pendingCount(): number {
    return this.pending.size;
  }
}

export class GenericOrchestratorBridge {
  constructor(private readonly orchestrator: ConversationOrchestrator) {}

  async onInboundMessage(message: { shop_id: string; conversation_id: string; buyer_id?: string; buyer?: string; platform_message_id?: string; content: string; timestamp?: string }): Promise<void> {
    const msg: BuyerMessage = {
      message_id: message.platform_message_id,
      shop_id: message.shop_id,
      buyer: message.buyer,
      buyer_id: message.buyer_id,
      content: message.content,
      timestamp: message.timestamp,
    };
    await this.orchestrator.onBuyerMessage(message.shop_id, message.conversation_id, msg);
  }

  async onHumanReply(shopId: string, conversationId: string): Promise<void> {
    await this.orchestrator.onHumanTakeover(shopId, conversationId);
  }

  onConversationChange(shopId: string): void {
    this.orchestrator.onFocusShop(shopId);
  }
}
