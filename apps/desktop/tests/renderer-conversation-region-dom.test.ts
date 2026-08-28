import { test } from "node:test";
import assert from "node:assert/strict";
import { renderConversationRegion } from "../dist/renderer/components/conversation-region.js";
import { EMPTY_UI_STATE, type UiState } from "../dist/renderer/state/view-model.js";
import type { WorkbenchActions } from "../dist/renderer/components/actions.js";
import type { TimelineMessageView } from "@fastwork/desktop-ipc";

// SHEEP-064 REPAIR #2 final-composed-DOM guard (NOT source-scan):
// renderConversationRegion composes panel + Timeline + Composer into SEPARATE
// sub-containers. In the FINAL composed DOM, for both populated and empty states,
// the Timeline surface and the Composer surface MUST coexist and the Timeline MUST
// be above the Composer (Composer never replaces/overrides the Timeline).

class FakeElement {
  tagName: string;
  children: FakeElement[] = [];
  parentNode: FakeElement | null = null;
  attributes: Record<string, string> = {};
  listeners: Record<string, Array<(e?: unknown) => void>> = {};
  textContent = "";
  id = "";
  value = "";
  type = "";
  rows = 0;
  disabled = false;
  htmlFor = "";
  tabIndex = 0;
  private _className = "";
  constructor(tag: string) { this.tagName = tag.toUpperCase(); }
  get className(): string { return this._className; }
  set className(v: string) { this._className = v; }
  get firstChild(): FakeElement | null { return this.children[0] ?? null; }
  appendChild(child: FakeElement): FakeElement { this.children.push(child); child.parentNode = this; return child; }
  removeChild(child: FakeElement): FakeElement { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); return child; }
  setAttribute(k: string, v: string): void { this.attributes[k] = v; }
  addEventListener(type: string, fn: (e?: unknown) => void): void { (this.listeners[type] = this.listeners[type] ?? []).push(fn); }
}

// minimal document shim sufficient for the conversation-region components
(globalThis as Record<string, unknown>).document = {
  createElement: (tag: string) => new FakeElement(tag),
};

function findByClass(root: FakeElement, cls: string): FakeElement[] {
  const out: FakeElement[] = [];
  const walk = (n: FakeElement): void => {
    if (n.className.split(/\s+/).includes(cls)) out.push(n);
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}

const NOOP_ACTIONS: WorkbenchActions = {
  onSelectShop: () => {}, onSetMode: () => {}, onManualSend: () => {}, onNoSaveSend: () => {}, onCancel: () => {},
  onPlatformBoundsChange: () => {}, onReloadPlatform: () => {}, onComposerDraftChange: () => {}, onComposerSubmit: () => {}, onApplySuggestion: () => {},
};

function msg(id: string, actor: "customer" | "agent", text: string): TimelineMessageView {
  return { message_id: id, actor, content_kind: "text", content_text: text, occurred_at: "2026-08-28T09:00:00Z" };
}

function populatedState(): UiState {
  return {
    ...EMPTY_UI_STATE,
    activeConversationId: "c1",
    queueItems: [{ conversation_id: "c1", store_id: "A1" }],
    timelineConversationId: "c1",
    timelineMessages: [msg("m1", "customer", "你好"), msg("m2", "agent", "亲，在的")],
    composerDrafts: { c1: "" },
  };
}
function emptyState(): UiState {
  return {
    ...EMPTY_UI_STATE,
    activeConversationId: "c1",
    queueItems: [{ conversation_id: "c1", store_id: "A1" }],
    timelineConversationId: "c1",
    timelineMessages: [],
    composerDrafts: { c1: "" },
  };
}

function composed(): { host: FakeElement; timelineHost: FakeElement; composerHost: FakeElement } {
  const host = new FakeElement("div");
  renderConversationRegion(host, populatedState(), NOOP_ACTIONS);
  const timelineHost = host.children[1];
  const composerHost = host.children[2];
  return { host, timelineHost, composerHost };
}

test("populated: final composed DOM has Timeline messages AND Composer, Timeline above Composer", () => {
  const { host, timelineHost, composerHost } = composed();
  assert.equal(host.children.length, 3, "panel + timeline + composer hosts");
  assert.equal(timelineHost.className, "conversation-timeline-host");
  assert.equal(composerHost.className, "composer-host");
  // both surfaces coexist
  assert.equal(findByClass(host, "message-timeline").length, 1, "Timeline surface present");
  assert.equal(findByClass(host, "composer").length, 1, "Composer surface present");
  // populated Timeline shows real message facts
  assert.equal(findByClass(timelineHost, "timeline-message").length, 2, "real Timeline message facts rendered");
  // order: timeline host BEFORE composer host
  assert.ok(host.children.indexOf(timelineHost) < host.children.indexOf(composerHost), "Timeline is above Composer");
});

test("empty: final composed DOM has Timeline no-message state AND Composer, Timeline above Composer", () => {
  const host = new FakeElement("div");
  renderConversationRegion(host, emptyState(), NOOP_ACTIONS);
  const timelineHost = host.children[1];
  const composerHost = host.children[2];
  assert.equal(findByClass(host, "message-timeline").length, 1, "Timeline surface present");
  assert.equal(findByClass(host, "composer").length, 1, "Composer surface present");
  assert.equal(findByClass(timelineHost, "fs-state--empty").length, 1, "Timeline no-message empty state rendered");
  assert.equal(findByClass(timelineHost, "timeline-message").length, 0, "no fabricated messages in empty");
  assert.ok(host.children.indexOf(timelineHost) < host.children.indexOf(composerHost), "Timeline is above Composer");
});
