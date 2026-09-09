import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { toDomDocument } from "../dist/dom/dom-types.js";
import {
  hasAuthReauthEvidence,
  hasAuthReauthLocation,
  hasAuthReauthModal,
} from "../dist/page/auth-reauth-detector.js";
import { PddPageRuntime, type PageTransport } from "../dist/page/page-runtime.js";
import type { PddPageCommand, PddPageCommandResult, PddPageEvent } from "../dist/types.js";

class FakeMutationObserver {
  private readonly callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
  }
  observe(): void {}
  disconnect(): void {}
  trigger(): void { this.callback(); }
}

function makeDocument(body: string, url = "https://mms.pinduoduo.com/chat/") {
  const dom = new JSDOM('<!doctype html><html><head><title>synthetic</title></head><body>' + body + '</body></html>', { url });
  return { dom, doc: toDomDocument(dom.window.document) };
}

function exactModal(extra = ""): string {
  return '<div role="dialog" class="el-message-box"><div class="el-message-box__title">登录过期</div><div class="el-message-box__message">登录已过期，请重新登录</div>' + extra + '</div>';
}

function makeTransport(events: PddPageEvent[]): PageTransport {
  return {
    send: (event) => events.push(event),
    onCommand: (_handler: (command: PddPageCommand) => Promise<PddPageCommandResult> | PddPageCommandResult) => () => {},
  };
}

function startRuntime(body: string, url?: string) {
  const { dom, doc } = makeDocument(body, url);
  const events: PddPageEvent[] = [];
  let observer: FakeMutationObserver | null = null;
  const runtime = new PddPageRuntime({
    doc,
    sessionId: "session-auth",
    shopId: "shop-auth",
    transport: makeTransport(events),
    makeObserver: (callback) => {
      observer = new FakeMutationObserver(callback);
      return observer;
    },
  });
  runtime.start();
  return { dom, doc, events, observer: observer!, runtime };
}

test("Signal A requires the exact title and message pair in one modal", () => {
  const { doc } = makeDocument(exactModal());
  assert.equal(hasAuthReauthModal(doc), true);
  assert.equal(hasAuthReauthEvidence(doc), true);
});

test("generic modal, title-only, message-only, and button-only text do not trigger", () => {
  const cases = [
    '<div class="el-message-box"><div class="el-message-box__title">系统提示</div><div class="el-message-box__message">请稍候</div></div>',
    '<div class="el-message-box"><div class="el-message-box__title">登录过期</div></div>',
    '<div class="el-message-box"><div class="el-message-box__message">登录已过期，请重新登录</div></div>',
    '<button>登录已过期，请重新登录</button>',
  ];
  for (const body of cases) {
    const { doc } = makeDocument(body);
    assert.equal(hasAuthReauthEvidence(doc), false, body);
  }
});

test("stale chat content does not suppress an exact Signal A", () => {
  const { doc } = makeDocument('<div data-fw-pdd-messages>登录已过期，请重新登录</div>' + exactModal());
  assert.equal(hasAuthReauthEvidence(doc), true);
});

test("Signal B requires the exact origin and pathname", () => {
  const approved = makeDocument("", "https://mms.pinduoduo.com/login/?next=chat").doc;
  const wrongOrigin = makeDocument("", "https://example.invalid/login/").doc;
  const wrongPath = makeDocument("", "https://mms.pinduoduo.com/login").doc;
  const titleOnly = makeDocument("", "https://mms.pinduoduo.com/chat/").doc;
  assert.equal(hasAuthReauthLocation(approved), true);
  assert.equal(hasAuthReauthLocation(wrongOrigin), false);
  assert.equal(hasAuthReauthLocation(wrongPath), false);
  assert.equal(hasAuthReauthLocation(titleOnly), false);
});

test("runtime emits AUTH_REAUTH_REQUIRED once and latches over prior READY", async () => {
  const { dom, events, observer, runtime } = startRuntime('<div data-fw-pdd-chat-list></div>' + exactModal());
  assert.deepEqual(events.map((event) => event.event), ["auth_reauth_required"]);
  dom.window.document.body.appendChild(dom.window.document.createElement("div"));
  observer.trigger();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(events.map((event) => event.event), ["auth_reauth_required"]);
  runtime.stop();
});

test("location Signal B emits AUTH_REAUTH_REQUIRED without requiring document.title", () => {
  const { events } = startRuntime("", "https://mms.pinduoduo.com/login/");
  assert.deepEqual(events.map((event) => event.event), ["auth_reauth_required"]);
});

test("disappearing markers and leaving /login/ do not recover the runtime latch", async () => {
  const { dom, events, observer } = startRuntime(exactModal(), "https://mms.pinduoduo.com/login/");
  assert.deepEqual(events.map((event) => event.event), ["auth_reauth_required"]);
  dom.window.document.body.innerHTML = "<div data-fw-pdd-chat-list></div>";
  observer.trigger();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(events.map((event) => event.event), ["auth_reauth_required"]);
});
