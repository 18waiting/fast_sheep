import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { toDomDocument } from "../dist/dom/dom-types.js";
import { PddPageRuntime, type PageTransport } from "../dist/page/page-runtime.js";
import type { PddPageCommand, PddPageCommandResult, PddPageEvent } from "../dist/types.js";

class FakeMutationObserver {
  readonly callback: () => void;
  options: unknown;

  constructor(callback: () => void) {
    this.callback = callback;
  }

  observe(_target: unknown, options: unknown): void {
    this.options = options;
  }

  disconnect(): void {}

  trigger(): void {
    this.callback();
  }
}

function makeTransport(events: PddPageEvent[]): PageTransport {
  return {
    send: (event) => events.push(event),
    onCommand: (_handler: (command: PddPageCommand) => Promise<PddPageCommandResult> | PddPageCommandResult) => () => {},
  };
}

function makeRuntime(rows: string[]) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div data-fw-pdd-chat-list>
      <div data-fw-pdd-conversation data-conversation-id="synthetic-c1" data-active="true" data-buyer-id="synthetic-buyer">Buyer</div>
      ${rows.join("")}
    </div>
    <div data-fw-pdd-messages>
      <div data-fw-pdd-message data-message-id="synthetic-m1" data-direction="inbound">
        <span data-fw-pdd-msg-content>hello</span>
      </div>
    </div>
    <textarea data-fw-pdd-composer-input></textarea>
    <button data-fw-pdd-send-btn>send</button>
  </body></html>`);
  const events: PddPageEvent[] = [];
  let observer: FakeMutationObserver | null = null;
  const runtime = new PddPageRuntime({
    doc: toDomDocument(dom.window.document),
    sessionId: "session-selected",
    shopId: "shop-selected",
    transport: makeTransport(events),
    makeObserver: (callback) => {
      observer = new FakeMutationObserver(callback);
      return observer;
    },
  });
  runtime.start();
  return { dom, events, observer: observer!, runtime };
}

function selectedEvents(events: PddPageEvent[]): PddPageEvent[] {
  return events.filter((event) => event.event === "selected_customer_observed");
}

function selectedEvent(events: PddPageEvent[], index: number): PddPageEvent {
  const event = selectedEvents(events)[index];
  assert.ok(event);
  return event;
}

async function waitForScan(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

function rowsFor(aActive: boolean, bActive: boolean): string[] {
  return [
    `<div class="chat-item-box${aActive ? " active" : ""}" data-random="10101-0-all"></div>`,
    `<div class="chat-item-box${bActive ? " active" : ""}" data-random="20202-1-all"></div>`,
  ];
}

test("supported runtime emits the selected buyer independently of conversation_changed", () => {
  const { events } = makeRuntime(rowsFor(true, false));
  const event = selectedEvent(events, 0);
  assert.deepEqual(event, {
    event: "selected_customer_observed",
    session_id: "session-selected",
    shop_id: "shop-selected",
    status: "SELECTED",
    customer_uid: "10101",
  });
  assert.equal("conversation_id" in event, false);
  assert.equal("data-random" in event, false);
});

test("runtime emits A to B, B to A, and A to NONE transitions once each", () => {
  const { dom, events, runtime } = makeRuntime(rowsFor(true, false));
  const rows = dom.window.document.querySelectorAll("div.chat-item-box");
  const rowA = rows[0] as HTMLElement;
  const rowB = rows[1] as HTMLElement;

  rowA.className = "chat-item-box";
  rowB.className = "chat-item-box active";
  runtime.scan();
  rowA.className = "chat-item-box active";
  rowB.className = "chat-item-box";
  runtime.scan();
  rowA.className = "chat-item-box";
  runtime.scan();

  assert.deepEqual(selectedEvents(events).map((event) => (event.event === "selected_customer_observed" ? event.status : null)), [
    "SELECTED", "SELECTED", "SELECTED", "NONE",
  ]);
  assert.deepEqual(selectedEvents(events).map((event) => (event.event === "selected_customer_observed" && event.status === "SELECTED" ? event.customer_uid : undefined)), [
    "10101", "20202", "10101", undefined,
  ]);
});

test("multiple active rows emit UNKNOWN and recover to a valid selected buyer", () => {
  const { dom, events, runtime } = makeRuntime(rowsFor(true, false));
  const rows = dom.window.document.querySelectorAll("div.chat-item-box");
  const rowA = rows[0] as HTMLElement;
  const rowB = rows[1] as HTMLElement;

  rowB.className = "chat-item-box active";
  runtime.scan();
  rowA.className = "chat-item-box";
  runtime.scan();

  assert.deepEqual(selectedEvents(events).map((event) => event.event === "selected_customer_observed" ? event.status : null), ["SELECTED", "UNKNOWN", "SELECTED"]);
  const unknown = selectedEvent(events, 1);
  assert.equal("customer_uid" in unknown, false);
  const recovered = selectedEvent(events, 2);
  assert.equal(recovered.event, "selected_customer_observed");
  if (recovered.event === "selected_customer_observed") assert.equal(recovered.customer_uid, "20202");
});

test("class-only mutation detects selection changes and observer uses a narrow class filter", async () => {
  const { dom, events, observer } = makeRuntime(rowsFor(true, false));
  assert.deepEqual(observer.options, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  const rows = dom.window.document.querySelectorAll("div.chat-item-box");
  (rows[0] as HTMLElement).className = "chat-item-box";
  (rows[1] as HTMLElement).className = "chat-item-box active";
  observer.trigger();
  await waitForScan();

  assert.deepEqual(selectedEvents(events).map((event) => event.event === "selected_customer_observed" ? event.customer_uid : undefined), ["10101", "20202"]);
});

test("unchanged observations, unrelated active elements, and unrelated mutations do not duplicate", async () => {
  const { dom, events, observer, runtime } = makeRuntime([
    '<div class="active unrelated"></div>',
  ].concat(rowsFor(false, false)));
  assert.deepEqual(selectedEvents(events).map((event) => event.event === "selected_customer_observed" ? event.status : null), ["NONE"]);

  dom.window.document.body.appendChild(dom.window.document.createElement("aside"));
  observer.trigger();
  await waitForScan();
  runtime.scan();
  assert.equal(selectedEvents(events).length, 1);

  const event = selectedEvent(events, 0);
  assert.equal("customer_uid" in event, false);
});

test("a new runtime instance starts with its own observation state", () => {
  const first = makeRuntime(rowsFor(true, false));
  const second = makeRuntime(rowsFor(true, false));
  assert.equal(selectedEvents(first.events).length, 1);
  assert.equal(selectedEvents(second.events).length, 1);
});
