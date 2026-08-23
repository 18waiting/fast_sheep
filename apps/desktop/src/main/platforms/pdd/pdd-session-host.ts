// M7 PDD session host (clean-room). Per-shop session state machine + view lifecycle.
import type { PddPageEvent } from "@fastwork/platform-pdd";
import { PddSessionState } from "@fastwork/platform-pdd";
import type { PddViewHost, ViewBounds } from "./pdd-view-host.js";

export interface PddSessionHostOptions {
  shopId: string;
  makeView: () => PddViewHost;
  onEvent?: (ev: PddPageEvent) => void;
  /** Called after the view is created but BEFORE the page loads (trusted-set wiring). */
  onViewCreated?: (view: PddViewHost) => void;
}

export class PddSessionHost {
  readonly state: PddSessionState;
  private view: PddViewHost | null = null;
  private readonly onEventHook: ((ev: PddPageEvent) => void) | undefined;
  private readonly onViewCreatedHook: ((view: PddViewHost) => void) | undefined;

  constructor(options: PddSessionHostOptions) {
    this.state = new PddSessionState(options.shopId, "pdd-session-" + options.shopId);
    this.makeView = options.makeView;
    this.onEventHook = options.onEvent;
    this.onViewCreatedHook = options.onViewCreated;
    this.state.setStatus("STOPPED");
  }

  private readonly makeView: () => PddViewHost;

  get viewHost(): PddViewHost | null {
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

  activate(): void {
    this.view?.show();
  }

  hide(): void {
    this.view?.hide();
  }

  setViewBounds(bounds: ViewBounds, contentBounds: ViewBounds): void {
    this.view?.setBounds(bounds, contentBounds);
  }

  async reload(fixturePath?: string): Promise<void> {
    if (fixturePath && this.view) {
      await this.view.loadLocalFixture(fixturePath, { shop_id: this.state.shopId, session_id: this.state.sessionId });
    }
  }

  handleEvent(ev: PddPageEvent): void {
    if (ev.event === "page_ready") this.state.setStatus("READY");
    else if (ev.event === "login_required") this.state.setStatus("LOGIN_REQUIRED");
    else if (ev.event === "dom_unsupported") this.state.setStatus("DOM_UNSUPPORTED", ev.reason ?? "DOM_UNSUPPORTED");
    else if (ev.event === "conversation_changed" && ev.conversation_id) {
      this.state.setConversation(ev.conversation_id, ev.buyer_id);
    }
    this.onEventHook?.(ev);
  }

  dispose(): void {
    this.view?.dispose();
    this.view = null;
    this.state.setStatus("DISPOSED");
  }
}
