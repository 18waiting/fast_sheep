import { test } from "node:test";
import assert from "node:assert/strict";
import { PddSessionHost } from "../dist/main/platforms/pdd/pdd-session-host.js";
import { bindPddDocumentLifecycle } from "../dist/main/platforms/pdd/pdd-document-lifecycle.js";
import type { PddPageEvent } from "@fastwork/platform-pdd";

class FakeView {
  isVisible = false;
  loaded: string | null = null;
  fixtureQuery: Record<string, string> | null = null;
  visible = false;
  observations: Array<{ session_id: string; shop_id: string; document_generation: number }> = [];
  private lifecycleObserver: {
    onMainFrameNavigationStart(): void;
    onMainFrameDomReady(): void;
    onMainFrameLoadFailure(): void;
  } | null = null;
  private readonly listeners = new Map<string, (...args: unknown[]) => void>();
  webContents = {
    send: (_channel: string, _payload: unknown) => {},
    isDestroyed: () => false,
    on: (event: string, listener: (...args: unknown[]) => void) => {
      this.listeners.set(event, listener);
      return this.webContents;
    },
  };
  constructor() {
    bindPddDocumentLifecycle(this.webContents, {
      onMainFrameNavigationStart: () => this.lifecycleObserver?.onMainFrameNavigationStart(),
      onMainFrameDomReady: () => this.lifecycleObserver?.onMainFrameDomReady(),
      onMainFrameLoadFailure: () => this.lifecycleObserver?.onMainFrameLoadFailure(),
    });
  }
  async loadLocalFixture(p: string, query?: Record<string, string>): Promise<void> {
    this.loaded = p;
    this.fixtureQuery = query ?? null;
  }
  setDocumentLifecycleObserver(observer: typeof this.lifecycleObserver): void { this.lifecycleObserver = observer; }
  startDocumentObservation(observation: { session_id: string; shop_id: string; document_generation: number }): void {
    this.observations.push(observation);
  }
  emitNewMainDocument(): void { this.listeners.get("did-start-navigation")?.({}, "https://mms.pinduoduo.com/chat/", false, true); }
  emitSameDocumentNavigation(): void { this.listeners.get("did-start-navigation")?.({}, "https://mms.pinduoduo.com/chat/#in-place", true, true); }
  emitDomReady(): void { this.listeners.get("dom-ready")?.(); }
  emitLoadFailure(): void { this.listeners.get("did-fail-load")?.({}, -2, "failed", "https://mms.pinduoduo.com/chat/", true); }
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  setBounds(_b: unknown, _c: unknown): void {}
  dispose(): void { this.loaded = null; }
}

test("session host lifecycle: create/load/ready/dispose", async () => {
  const events: string[] = [];
  const host = new PddSessionHost({
    shopId: "shop-1",
    makeView: () => new FakeView() as never,
    onEvent: (ev) => events.push(ev.event),
  });
  assert.equal(host.state.getStatus(), "STOPPED");
  await host.createAndLoad("/fixtures/chat-basic.html");
  assert.equal(host.state.getStatus(), "LOADING");
  assert.equal((host.viewHost as unknown as FakeView).fixtureQuery?.document_generation, "1");
  host.handleEvent({ event: "page_ready", session_id: host.state.sessionId } as PddPageEvent);
  assert.equal(host.state.getStatus(), "READY");
  assert.ok(events.includes("page_ready"));
  host.dispose();
  assert.equal(host.state.getStatus(), "DISPOSED");
});

test("session tracks active conversation and login/dom-unsupported states", () => {
  const host = new PddSessionHost({ shopId: "shop-1", makeView: () => new FakeView() as never });
  host.state.setStatus("CREATING");
  host.state.setStatus("LOADING");
  host.handleEvent({ event: "conversation_changed", session_id: host.state.sessionId, shop_id: "shop-1", conversation_id: "c1", buyer_id: "b1" } as PddPageEvent);
  assert.equal(host.state.getActiveConversationId(), "c1");
  host.handleEvent({ event: "login_required", session_id: host.state.sessionId } as PddPageEvent);
  assert.equal(host.state.getStatus(), "LOGIN_REQUIRED");
  host.handleEvent({ event: "dom_unsupported", session_id: host.state.sessionId, reason: "missing selectors" } as PddPageEvent);
  assert.equal(host.state.getStatus(), "DOM_UNSUPPORTED");
  assert.equal(host.state.getLastError(), "missing selectors");
});

test("login-required recovers when the page runtime reports a fresh page-ready observation", () => {
  const host = new PddSessionHost({ shopId: "shop-1", makeView: () => new FakeView() as never });
  host.state.setStatus("CREATING");
  host.state.setStatus("LOADING");

  host.handleEvent({ event: "login_required", session_id: host.state.sessionId } as PddPageEvent);
  assert.equal(host.state.getStatus(), "LOGIN_REQUIRED");
  host.handleEvent({ event: "page_ready", session_id: host.state.sessionId, status: "READY" } as PddPageEvent);

  assert.equal(host.state.getStatus(), "READY");
  assert.equal(host.state.view().status, "READY");
});

test("auth reauth is latched over readiness and recovers only through fresh reload lifecycle", async () => {
  const host = new PddSessionHost({ shopId: "shop-1", makeView: () => new FakeView() as never });
  await host.createAndLoad("/fixtures/chat-basic.html");
  host.handleEvent({ event: "page_ready", session_id: host.state.sessionId } as PddPageEvent);
  host.handleEvent({ event: "auth_reauth_required", session_id: host.state.sessionId } as PddPageEvent);
  assert.equal(host.state.getStatus(), "AUTH_REAUTH_REQUIRED");

  host.handleEvent({ event: "page_ready", session_id: host.state.sessionId } as PddPageEvent);
  host.handleEvent({ event: "login_required", session_id: host.state.sessionId } as PddPageEvent);
  host.handleEvent({ event: "dom_unsupported", session_id: host.state.sessionId } as PddPageEvent);
  assert.equal(host.state.getStatus(), "AUTH_REAUTH_REQUIRED");

  await host.reload("/fixtures/chat-basic.html");
  assert.equal(host.state.getStatus(), "LOADING");
  host.handleEvent({ event: "page_ready", session_id: host.state.sessionId } as PddPageEvent);
  assert.equal(host.state.getStatus(), "READY");
});

test("auth reauth, ERROR, DOM_UNSUPPORTED, and DISPOSED remain distinct", () => {
  const host = new PddSessionHost({ shopId: "shop-1", makeView: () => new FakeView() as never });
  host.state.setStatus("CREATING");
  host.state.setStatus("LOADING");
  host.handleEvent({ event: "auth_reauth_required", session_id: host.state.sessionId } as PddPageEvent);
  assert.equal(host.state.getStatus(), "AUTH_REAUTH_REQUIRED");
  host.dispose();
  assert.equal(host.state.getStatus(), "DISPOSED");
});

test("real main-document lifecycle drives recovery and fresh generation only", () => {
  let view: FakeView | undefined;
  const host = new PddSessionHost({
    shopId: "shop-live-shaped",
    makeView: () => { view = new FakeView(); return view as never; },
  });
  void host.createAndLoad();
  host.handleEvent({ event: "auth_reauth_required", session_id: host.state.sessionId } as PddPageEvent);
  assert.equal(host.state.getStatus(), "AUTH_REAUTH_REQUIRED");

  view!.emitSameDocumentNavigation();
  assert.equal(host.state.getStatus(), "AUTH_REAUTH_REQUIRED");
  view!.emitNewMainDocument();
  assert.equal(host.state.getStatus(), "LOADING");
  view!.emitDomReady();
  const generation = view!.observations[0]?.document_generation;
  assert.equal(generation, 1);

  host.handleEvent({ event: "page_ready", session_id: host.state.sessionId, document_generation: generation! } as PddPageEvent);
  assert.equal(host.state.getStatus(), "READY");
});

test("old-document page_ready, marker disappearance, and wrong session cannot recover", () => {
  let view: FakeView | undefined;
  const host = new PddSessionHost({
    shopId: "shop-old-document",
    makeView: () => { view = new FakeView(); return view as never; },
  });
  void host.createAndLoad();
  host.handleEvent({ event: "auth_reauth_required", session_id: host.state.sessionId } as PddPageEvent);
  view!.emitNewMainDocument();
  view!.emitDomReady();
  view!.emitNewMainDocument();
  assert.equal(host.state.getStatus(), "LOADING");
  host.handleEvent({ event: "page_ready", session_id: host.state.sessionId } as PddPageEvent);
  assert.equal(host.state.getStatus(), "LOADING");
  host.handleEvent({ event: "page_ready", session_id: host.state.sessionId, document_generation: 1 } as PddPageEvent);
  assert.equal(host.state.getStatus(), "LOADING");
  host.handleEvent({ event: "page_ready", session_id: "wrong-session", document_generation: 2 } as PddPageEvent);
  assert.equal(host.state.getStatus(), "LOADING");
  host.handleEvent({ event: "auth_reauth_required", session_id: host.state.sessionId, document_generation: 2 } as PddPageEvent);
  assert.equal(host.state.getStatus(), "AUTH_REAUTH_REQUIRED");
});

test("new-document Signal A/B, unsupported pages, and lifecycle failures fail closed", () => {
  let view: FakeView | undefined;
  const host = new PddSessionHost({
    shopId: "shop-fail-closed",
    makeView: () => { view = new FakeView(); return view as never; },
  });
  void host.createAndLoad();
  host.handleEvent({ event: "auth_reauth_required", session_id: host.state.sessionId } as PddPageEvent);

  view!.emitNewMainDocument();
  view!.emitDomReady();
  host.handleEvent({ event: "dom_unsupported", session_id: host.state.sessionId, document_generation: 1, reason: "unsupported" } as PddPageEvent);
  assert.equal(host.state.getStatus(), "DOM_UNSUPPORTED");

  view!.emitNewMainDocument();
  view!.emitDomReady();
  host.handleEvent({ event: "auth_reauth_required", session_id: host.state.sessionId, document_generation: 2 } as PddPageEvent);
  assert.equal(host.state.getStatus(), "AUTH_REAUTH_REQUIRED");

  view!.emitNewMainDocument();
  assert.equal(host.state.getStatus(), "LOADING");
  view!.emitLoadFailure();
  assert.equal(host.state.getStatus(), "ERROR");
  assert.equal(host.state.getLastError(), "SESSION_DOCUMENT_LOAD_FAILED");
});

test("repeated main-document lifecycle events are deterministic and READY stays local", () => {
  let view: FakeView | undefined;
  const host = new PddSessionHost({
    shopId: "shop-idempotent",
    makeView: () => { view = new FakeView(); return view as never; },
  });
  void host.createAndLoad();
  view!.emitNewMainDocument();
  view!.emitNewMainDocument();
  assert.equal(host.state.getStatus(), "LOADING");
  view!.emitDomReady();
  view!.emitDomReady();
  assert.equal(view!.observations.length, 1);
  host.handleEvent({ event: "page_ready", session_id: host.state.sessionId, document_generation: 2 } as PddPageEvent);
  assert.equal(host.state.getStatus(), "READY");
  assert.equal(host.state.isAuthReauthRequired(), false);
  assert.equal(host.state.getLastError(), null);
});

test("auth reauth event from another session cannot mutate this host", () => {
  const host = new PddSessionHost({ shopId: "shop-1", makeView: () => new FakeView() as never });
  host.handleEvent({ event: "auth_reauth_required", session_id: "other-session" } as PddPageEvent);
  assert.equal(host.state.getStatus(), "STOPPED");
});

test("session host fails closed on an illegal or unknown runtime signal", () => {
  const host = new PddSessionHost({ shopId: "shop-1", makeView: () => new FakeView() as never });
  host.state.setStatus("CREATING");
  host.state.setStatus("LOADING");
  host.handleEvent({ event: "page_ready", session_id: host.state.sessionId } as PddPageEvent);
  host.handleEvent({ event: "login_required", session_id: host.state.sessionId } as PddPageEvent);
  assert.equal(host.state.getStatus(), "ERROR");
  assert.equal(host.state.getLastError(), "ILLEGAL_SESSION_EVENT");

  const unknown = new PddSessionHost({ shopId: "shop-2", makeView: () => new FakeView() as never });
  unknown.state.setStatus("CREATING");
  unknown.state.setStatus("LOADING");
  unknown.handleEvent({ event: "future_event", session_id: unknown.state.sessionId } as never);
  assert.equal(unknown.state.getStatus(), "ERROR");
  assert.equal(unknown.state.getLastError(), "UNSUPPORTED_SESSION_EVENT");
});

test("session host ignores an event from another session", () => {
  const host = new PddSessionHost({ shopId: "shop-1", makeView: () => new FakeView() as never });
  host.handleEvent({ event: "page_ready", session_id: "other-session" } as PddPageEvent);
  assert.equal(host.state.getStatus(), "STOPPED");
});
