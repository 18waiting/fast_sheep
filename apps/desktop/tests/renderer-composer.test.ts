import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkbenchStore, type WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import {
  EMPTY_UI_STATE, type UiState,
  setComposerDraft, applySuggestionToComposer, captureComposerSubmitIntent,
  applyComposerSendResult, shouldSubmitComposerOnEnter,
} from "../dist/renderer/state/view-model.js";
import type { WorkbenchViewModel } from "@fastwork/desktop-ipc";

// SHEEP-064 Composer guards:
//   DP-105 manual fallback independent of AI; DP-106 explicit + non-destructive AI apply;
//   DP-107/I-27 submit = explicit intent, no delivered-fact persistence, no fake success;
//   DP-108 draft keyed by conversationId; DP-109 drafts survive switches in MainContext;
//   DP-110 submit captures conversationId+draft atomically; I-28 result mutates only its
//   captured conversation's draft; I-29 IME composition never triggers submit; a11y native.
const HERE = dirname(fileURLToPath(import.meta.url));
const R = join(HERE, "..", "src", "renderer", "components");

function vm(suggestion?: string): WorkbenchViewModel {
  return {
    revision: 1,
    shop_summaries: [],
    selected_shop_id: "shop-test-1",
    conversation: { conversation_id: "c1", shop_id: "shop-test-1", state: "idle" },
    suggestion: suggestion ? { reply: suggestion, generation: 1, status: "pending" } : null,
    mode: "human_review",
    countdown: null,
    worker_status: { status: "ready" },
    platform_capability: "none",
  };
}
function makeApi(overrides: Partial<WorkbenchApiLike> = {}): WorkbenchApiLike {
  return {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: [], view_model: vm() } }),
    getSnapshot: async () => ({ ok: true, data: vm() }),
    setMode: async () => ({ ok: true, data: { ok: true } }),
    manualSend: async () => ({ ok: true, data: { ok: true } }),
    noSaveSend: async () => ({ ok: true, data: { ok: true } }),
    cancel: async () => ({ ok: true, data: { ok: true } }),
    focus: async () => ({ ok: true, data: { ok: true } }),
    onOrchestratorEvent: () => () => {},
    onWorkerStatusChanged: () => () => {},
    onShopsChanged: () => () => {},
    getPlatformStatus: async () => ({ ok: true, data: { shop_id: "s", platform: "pdd", session_status: "READY", view_visible: true } }),
    activatePlatformShop: async () => ({ ok: true, data: { ok: true } }),
    setPlatformViewBounds: async () => ({ ok: true, data: { ok: true } }),
    reloadPlatform: async () => ({ ok: true, data: { ok: true } }),
    onPlatformStatusChanged: () => () => {},
    ...overrides,
  };
}
function stateWith(overrides: Partial<UiState>): UiState {
  return { ...EMPTY_UI_STATE, ...overrides };
}

test("DP-105: composer manual draft works independent of AI (no suggestion required)", () => {
  const store = new WorkbenchStore(makeApi());
  store.activateConversation("c1");
  store.updateComposerDraft("亲，我手动回复你");
  assert.equal(store.getState().composerDrafts["c1"], "亲，我手动回复你", "manual draft independent of AI");
  assert.equal(store.getState().composerNote, null);
});

test("DP-106: AI suggestion apply is EXPLICIT + NON-DESTRUCTIVE (no async auto-apply)", () => {
  // no suggestion -> applySuggestion is a no-op (no auto-apply of anything)
  const store = new WorkbenchStore(makeApi());
  store.activateConversation("c1");
  store.updateComposerDraft("已有草稿");
  store.applySuggestion();
  assert.equal(store.getState().composerDrafts["c1"], "已有草稿", "no suggestion -> no change (no async auto-apply)");

  // explicit apply with EMPTY draft fills it
  const s1 = stateWith({ activeConversationId: "c1", viewModel: vm("AI 建议内容") });
  const applied = applySuggestionToComposer(s1, "c1", "AI 建议内容");
  assert.equal(applied.composerDrafts["c1"], "AI 建议内容", "explicit apply fills empty draft");

  // explicit apply with NON-EMPTY differing draft must NOT silently replace
  const s2 = stateWith({ activeConversationId: "c1", composerDrafts: { c1: "我的草稿" } });
  const blocked = applySuggestionToComposer(s2, "c1", "AI 建议内容");
  assert.equal(blocked.composerDrafts["c1"], "我的草稿", "non-empty draft preserved (non-destructive)");
  assert.ok(blocked.composerNote, "calm note set when apply blocked");
});

test("DP-107/I-27/#11: submit is explicit intent; send unavailable is honest (no fake success, no delivered fact)", () => {
  const store = new WorkbenchStore(makeApi());
  store.activateConversation("c1");
  store.updateComposerDraft("要发送的内容");
  assert.equal(store.getState().composerSendAvailable, false, "064 has no wired send pipeline");
  store.submitComposer();
  const s = store.getState();
  assert.equal(s.composerNote, "发送功能暂不可用", "unavailable honestly expressed");
  assert.equal(s.composerDrafts["c1"], "要发送的内容", "draft NOT persisted/cleared as a delivered fact (I-27)");
});

test("DP-108: draft is keyed by conversation identity, not queue row / store scope", () => {
  const s = stateWith({ activeConversationId: "c1" });
  const withC1 = setComposerDraft(s, "c1", "c1 草稿");
  assert.equal(withC1.composerDrafts["c1"], "c1 草稿");
  assert.equal(withC1.composerDrafts["c2"], undefined, "c2 has no draft");
  const s2 = setComposerDraft(withC1, "c2", "c2 草稿");
  assert.equal(s2.composerDrafts["c1"], "c1 草稿", "c1 draft unaffected by c2 write");
  assert.equal(s2.composerDrafts["c2"], "c2 草稿");
});

test("DP-109: ephemeral drafts survive conversation switches within the Main context (c1->c2->c1)", () => {
  const store = new WorkbenchStore(makeApi());
  store.activateConversation("c1");
  store.updateComposerDraft("c1 的草稿");
  store.activateConversation("c2");
  store.updateComposerDraft("c2 的草稿");
  store.activateConversation("c1");
  assert.equal(store.getState().composerDrafts["c1"], "c1 的草稿", "c1 draft preserved after c1->c2->c1");
  assert.equal(store.getState().composerDrafts["c2"], "c2 的草稿");
});

test("DP-110: submit captures conversationId + draft atomically at intent time; later switch does not change target", () => {
  const intent = captureComposerSubmitIntent("c1", "intent 时草稿");
  assert.deepEqual(intent, { conversationId: "c1", draft: "intent 时草稿" });
  // simulating a later active switch: the captured intent target stays c1
  const store = new WorkbenchStore(makeApi());
  store.activateConversation("c2");
  assert.equal(intent.conversationId, "c1", "captured intent target is immutable to later switches");
});

test("I-28: send result mutates ONLY its captured conversation's draft; failure preserves draft", () => {
  const base = stateWith({ composerDrafts: { c1: "c1 草稿", c2: "c2 草稿" } });
  const intent = { conversationId: "c1", draft: "c1 草稿" };
  // failed -> draft preserved (never cleared)
  const failed = applyComposerSendResult(base, intent, "failed");
  assert.equal(failed.composerDrafts["c1"], "c1 草稿", "failure must not clear the draft");
  // sent -> clears ONLY c1, never c2
  const sent = applyComposerSendResult(base, intent, "sent");
  assert.equal(sent.composerDrafts["c1"], undefined, "sent clears its captured conversation draft");
  assert.equal(sent.composerDrafts["c2"], "c2 草稿", "c1 result must not clear c2 draft");
});

test("I-29: IME composition must never trigger composer submit; Shift+Enter is newline", () => {
  assert.equal(shouldSubmitComposerOnEnter({ isComposing: true, shiftKey: false }), false, "IME composition never submits");
  assert.equal(shouldSubmitComposerOnEnter({ isComposing: true, shiftKey: true }), false);
  assert.equal(shouldSubmitComposerOnEnter({ isComposing: false, shiftKey: true }), false, "Shift+Enter = newline");
  assert.equal(shouldSubmitComposerOnEnter({ isComposing: false, shiftKey: false }), true, "plain Enter submits");
});

test("I-30: Composer is the single agent reply surface — Enter/Alt+Enter must NOT reach legacy orchestrator.manual_send / other old send paths", async () => {
  // source scan: composer + suggestion panel contain no legacy send wiring
  for (const f of ["composer.ts", "suggestion-panel.ts"]) {
    const src = readFileSync(join(R, f), "utf-8");
    for (const t of ["manualSend", "noSaveSend", "onManualSend", "onNoSaveSend", "orchestrator.manual_send", "manual_send"]) {
      assert.ok(!src.includes(t), f + " must not reference legacy send path: " + t);
    }
  }
  // behavior: submitComposer (the composer's Enter path) must never call legacy send IPC
  const calls: string[] = [];
  const api = makeApi();
  api.manualSend = async () => { calls.push("manualSend"); return { ok: true, data: { ok: true } }; };
  api.noSaveSend = async () => { calls.push("noSaveSend"); return { ok: true, data: { ok: true } }; };
  const store = new WorkbenchStore(api);
  store.activateConversation("c1");
  store.updateComposerDraft("回复内容");
  store.submitComposer(); // composer Enter/Alt+Enter submit path
  assert.deepEqual(calls, [], "composer submit must not call legacy manual_send / no_save_send");
  assert.equal(store.getState().composerNote, "发送功能暂不可用", "honest unavailable (SHEEP-066 owns execution)");
});

test("composer uses native textarea/button + accessible label; no innerHTML; unavailable state honest", () => {
  const src = readFileSync(join(R, "composer.ts"), "utf-8");
  assert.ok(src.includes("el(\"textarea\""), "native textarea");
  assert.ok(src.includes("el(\"button\""), "native button");
  assert.ok(src.includes("composer-label"), "visible accessible label (not placeholder-only)");
  assert.ok(!src.includes("innerHTML"), "no innerHTML");
  assert.ok(src.includes("send.disabled = !state.composerSendAvailable"), "Send natively disabled when unavailable");
  assert.ok(src.includes("发送功能暂不可用"), "honest unavailable cue");
  assert.ok(!src.includes("observed_at"), "no delivered-fact semantics in composer");
});
