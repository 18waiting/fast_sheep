import { test } from "node:test";
import assert from "node:assert/strict";
import { domHealth } from "../dist/dom/dom-health.js";
import { PDD_SELECTOR_PROFILE } from "../dist/selector-profile.js";
import { loadFixture } from "./helpers.ts";
import { PddPageRuntime, type PageTransport } from "../dist/page/page-runtime.js";
import type { PddPageCommand, PddPageCommandResult, PddPageEvent } from "../dist/types.js";

class FakeMutationObserver {
  callback: () => void;
  observed = false;
  disconnected = false;

  constructor(callback: () => void) { this.callback = callback; }
  observe(): void { this.observed = true; }
  disconnect(): void { this.disconnected = true; }
  trigger(): void { this.callback(); }
}

function makeTransport(events: PddPageEvent[]): PageTransport {
  return {
    send: (event) => events.push(event),
    onCommand: (_handler: (command: PddPageCommand) => Promise<PddPageCommandResult> | PddPageCommandResult) => () => {},
  };
}

test("chat-basic fixture is DOM-ready", () => {
  const h = domHealth(loadFixture("chat-basic.html"), PDD_SELECTOR_PROFILE);
  assert.equal(h.ready, true);
});

test("dom-unsupported fixture fails safe with DOM_UNSUPPORTED", () => {
  const h = domHealth(loadFixture("dom-unsupported.html"), PDD_SELECTOR_PROFILE);
  assert.equal(h.ready, false);
  assert.equal(h.reason, "DOM_UNSUPPORTED");
  assert.ok(h.missing.length > 0);
});

test("login-required fixture still reports a login marker", () => {
  const doc = loadFixture("login-required.html");
  assert.ok(doc.querySelector("[data-fw-pdd-login]") !== null);
});

test("login-required runtime keeps observing and emits page_ready only after fresh DOM readiness", async () => {
  const doc = loadFixture("login-required.html");
  const events: PddPageEvent[] = [];
  let observer: FakeMutationObserver | null = null;
  const runtime = new PddPageRuntime({
    doc,
    sessionId: "session-1",
    shopId: "shop-1",
    transport: makeTransport(events),
    makeObserver: (callback) => {
      const instance = new FakeMutationObserver(callback);
      observer = instance;
      return instance;
    },
  });

  runtime.start();
  assert.deepEqual(events.map((event) => event.event), ["login_required"]);
  assert.equal(observer?.observed, true);
  observer!.trigger();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(events.map((event) => event.event), ["login_required"], "repeated login-required observations are idempotent");

  const loginMarkers = doc.querySelectorAll("[data-fw-pdd-login]") as unknown as Array<{ removeAttribute(name: string): void }>;
  assert.equal(loginMarkers.length > 0, true);
  for (const marker of loginMarkers) marker.removeAttribute("data-fw-pdd-login");
  observer!.trigger();
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.deepEqual(events.map((event) => event.event), ["login_required", "page_ready", "conversation_changed", "message_received"]);
  assert.equal(events[1]?.event, "page_ready");
});

test("login-required runtime remains fail-closed when the fresh page is unsupported", async () => {
  const doc = loadFixture("login-required.html");
  const events: PddPageEvent[] = [];
  let observer: FakeMutationObserver | null = null;
  const runtime = new PddPageRuntime({
    doc,
    sessionId: "session-unsupported",
    shopId: "shop-unsupported",
    transport: makeTransport(events),
    makeObserver: (callback) => {
      observer = new FakeMutationObserver(callback);
      return observer;
    },
  });

  runtime.start();
  const loginMarkers = doc.querySelectorAll("[data-fw-pdd-login]") as unknown as Array<{ removeAttribute(name: string): void }>;
  assert.equal(loginMarkers.length > 0, true);
  for (const marker of loginMarkers) marker.removeAttribute("data-fw-pdd-login");
  (doc.querySelector("[data-fw-pdd-chat-list]") as unknown as { removeAttribute(name: string): void }).removeAttribute("data-fw-pdd-chat-list");
  observer!.trigger();
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.deepEqual(events.map((event) => event.event), ["login_required", "dom_unsupported"]);
});
