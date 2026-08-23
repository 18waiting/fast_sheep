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
  host.handleEvent({ event: "conversation_changed", session_id: "s", shop_id: "shop-1", conversation_id: "c1", buyer_id: "b1" } as PddPageEvent);
  assert.equal(host.state.getActiveConversationId(), "c1");
  host.handleEvent({ event: "login_required", session_id: "s" } as PddPageEvent);
  assert.equal(host.state.getStatus(), "LOGIN_REQUIRED");
  host.handleEvent({ event: "dom_unsupported", session_id: "s", reason: "missing selectors" } as PddPageEvent);
  assert.equal(host.state.getStatus(), "DOM_UNSUPPORTED");
  assert.equal(host.state.getLastError(), "missing selectors");
});
