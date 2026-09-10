// M7 PDD session host (clean-room). Per-shop session state machine + view lifecycle.
import type { PddPageEvent } from "@fastwork/platform-pdd";
import { PddSessionState } from "@fastwork/platform-pdd";
import type { PddViewHost, ViewBounds } from "./pdd-view-host.js";
import type { PddDocumentLifecycleObserver } from "./pdd-document-lifecycle.js";

export interface PddSessionHostOptions {
  shopId: string;
  makeView: () => PddViewHost;
  onEvent?: (ev: PddPageEvent) => void;
  /** Called after the view is created but BEFORE the page loads (trusted-set wiring). */
  onViewCreated?: (view: PddViewHost) => void;
}

const SESSION_EVENTS: ReadonlySet<PddPageEvent["event"]> = new Set([
  "page_ready",
  "login_required",
  "dom_unsupported",
  "auth_reauth_required",
  "conversation_changed",
  "message_received",
  "human_reply_detected",
  "send_ack",
  "transfer_ack",
]);

export class PddSessionHost {
  readonly state: PddSessionState;
  private view: PddViewHost | null = null;
  private readonly onEventHook: ((ev: PddPageEvent) => void) | undefined;
  private readonly onViewCreatedHook: ((view: PddViewHost) => void) | undefined;
  private documentGeneration = 0;
  private activeDocumentGeneration: number | null = null;
  private startedDocumentGeneration: number | null = null;
  private fixtureDocumentGeneration: number | null = null;
  private awaitingExplicitNavigationStart = false;

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
    try {
      this.view = this.makeView();
      this.onViewCreatedHook?.(this.view);
      this.view.setDocumentLifecycleObserver?.(this.documentLifecycleObserver);
      if (fixturePath) {
        this.beginDocumentLifecycle(true);
        this.awaitingExplicitNavigationStart = true;
        await this.view.loadLocalFixture(fixturePath, {
          shop_id: this.state.shopId,
          session_id: this.state.sessionId,
          document_generation: String(this.activeDocumentGeneration),
        });
        this.awaitingExplicitNavigationStart = false;
      }
    } catch (error) {
      this.failClosed("SESSION_CREATE_OR_LOAD_FAILED");
      throw error;
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
      this.beginDocumentLifecycle(true);
      this.awaitingExplicitNavigationStart = true;
      try {
        await this.view.loadLocalFixture(fixturePath, {
          shop_id: this.state.shopId,
          session_id: this.state.sessionId,
          document_generation: String(this.activeDocumentGeneration),
        });
        this.awaitingExplicitNavigationStart = false;
      } catch (error) {
        this.awaitingExplicitNavigationStart = false;
        this.failClosed("SESSION_RELOAD_FAILED");
        throw error;
      }
    }
  }

  handleEvent(ev: PddPageEvent): void {
    if (ev.session_id !== this.state.sessionId) return;
    if (!this.acceptsCurrentDocument(ev)) return;
    if (!SESSION_EVENTS.has(ev.event)) {
      this.failClosed("UNSUPPORTED_SESSION_EVENT");
      this.onEventHook?.(ev);
      return;
    }
    try {
      if (ev.event === "auth_reauth_required") this.state.setStatus("AUTH_REAUTH_REQUIRED");
      else if (this.state.isAuthReauthRequired() && !this.isFreshDocumentEvent(ev) && (ev.event === "page_ready" || ev.event === "login_required" || ev.event === "dom_unsupported")) {
        // A same-runtime or old-document observation cannot clear the auth latch.
      }
      else if (ev.event === "page_ready") this.state.setStatus("READY");
      else if (ev.event === "login_required") this.state.setStatus("LOGIN_REQUIRED");
      else if (ev.event === "dom_unsupported") this.state.setStatus("DOM_UNSUPPORTED", ev.reason ?? "DOM_UNSUPPORTED");
      else if (ev.event === "conversation_changed" && ev.conversation_id) {
        this.state.setConversation(ev.conversation_id, ev.buyer_id);
      }
    } catch {
      this.failClosed("ILLEGAL_SESSION_EVENT");
    }
    this.onEventHook?.(ev);
  }

  dispose(): void {
    this.view?.setDocumentLifecycleObserver?.(null);
    this.view?.dispose();
    this.view = null;
    this.state.setStatus("DISPOSED");
  }

  private failClosed(reason: string): void {
    if (this.state.getStatus() === "DISPOSED") return;
    if (this.state.isAuthReauthRequired()) return;
    this.state.setStatus("ERROR", reason);
  }

  private readonly documentLifecycleObserver: PddDocumentLifecycleObserver = {
    onMainFrameNavigationStart: () => {
      if (this.awaitingExplicitNavigationStart) {
        this.awaitingExplicitNavigationStart = false;
        return;
      }
      const status = this.state.getStatus();
      if (["CREATING", "LOADING", "READY", "DOM_UNSUPPORTED", "AUTH_REAUTH_REQUIRED", "ERROR"].includes(status)) {
        this.beginDocumentLifecycle();
      }
    },
    onMainFrameDomReady: () => {
      if (!this.view || this.activeDocumentGeneration === null) return;
      if (this.startedDocumentGeneration === this.activeDocumentGeneration) return;
      this.startedDocumentGeneration = this.activeDocumentGeneration;
      this.view.startDocumentObservation({
        session_id: this.state.sessionId,
        shop_id: this.state.shopId,
        document_generation: this.activeDocumentGeneration,
      });
    },
    onMainFrameLoadFailure: () => {
      if (this.state.getStatus() === "LOADING") this.failClosed("SESSION_DOCUMENT_LOAD_FAILED");
    },
  };

  private beginDocumentLifecycle(allowLegacyFixtureEvents = false): void {
    if (this.state.getStatus() !== "LOADING") this.state.setStatus("LOADING");
    this.documentGeneration += 1;
    this.activeDocumentGeneration = this.documentGeneration;
    this.startedDocumentGeneration = null;
    this.fixtureDocumentGeneration = allowLegacyFixtureEvents ? this.documentGeneration : null;
  }

  private acceptsCurrentDocument(ev: PddPageEvent): boolean {
    if (this.activeDocumentGeneration === null) return true;
    if (ev.document_generation !== undefined) return ev.document_generation === this.activeDocumentGeneration;
    // Only explicit fixture callers retain compatibility with legacy untagged
    // unit events. Real document generations require the Main-issued tag.
    return this.fixtureDocumentGeneration === this.activeDocumentGeneration
      && this.startedDocumentGeneration === null;
  }

  private isFreshDocumentEvent(ev: PddPageEvent): boolean {
    return this.activeDocumentGeneration !== null
      && ev.document_generation !== undefined
      && ev.document_generation === this.activeDocumentGeneration;
  }
}
