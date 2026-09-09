import { test } from "node:test";
import assert from "node:assert/strict";
import { PddSessionHost } from "../dist/main/platforms/pdd/pdd-session-host.js";
import type { PddPageEvent } from "@fastwork/platform-pdd";

class FakeView {
  isVisible = false;
  loaded: string | null = null;
  visible = false;
  async loadLocalFixture(p: string): Promise<void> { this.loaded = p; }
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  setBounds(_b: unknown, _c: unknown): void {}
  dispose(): void { this.loaded = null; }
  get webContents(): unknown { return {}; }
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
