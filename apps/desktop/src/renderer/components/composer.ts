// SHEEP-064 Composer (clean-room): manual professional-fallback reply input (DP-105),
// bound to the active conversation (DP-108). Drafts are ephemeral, keyed by
// conversationId, and survive switches within the Main context lifetime (DP-109).
// AI suggestion application is EXPLICIT + NON-DESTRUCTIVE (DP-106). Submit is
// EXPLICIT INTENT only (DP-107/I-27); execution belongs to SHEEP-066 — without a
// wired production Send capability the Send control honestly expresses unavailable
// (I-25/DP-48), never faking success. Native textarea/button; Enter submits only
// outside IME composition (I-29); Shift+Enter inserts a newline. Text rendered via textContent.
import type { UiState } from "../state/view-model.js";
import { shouldSubmitComposerOnEnter } from "../state/view-model.js";
import type { WorkbenchActions } from "./actions.js";
import { clear, el } from "./dom.js";

export function renderComposer(root: HTMLElement, state: UiState, actions: WorkbenchActions): void {
  clear(root);
  // DP-108: the composer is bound to the active conversation identity; no active -> no composer.
  const activeId = state.activeConversationId;
  if (activeId === null) return;
  const section = el("section", "composer");
  section.appendChild(el("h3", "panel-title", "回复"));

  const label = el("label", "composer-label", "回复内容") as HTMLLabelElement;
  label.htmlFor = "composer-input";
  section.appendChild(label);

  const draft = state.composerDrafts[activeId] ?? "";
  const textarea = el("textarea", "composer-input") as HTMLTextAreaElement;
  textarea.id = "composer-input";
  textarea.rows = 3;
  textarea.value = draft;
  textarea.addEventListener("input", () => actions.onComposerDraftChange(textarea.value));
  textarea.addEventListener("keydown", (e) => {
    // I-29: IME composition must never trigger submit; Shift+Enter = newline.
    if (e.key === "Enter" && shouldSubmitComposerOnEnter({ isComposing: e.isComposing, shiftKey: e.shiftKey })) {
      e.preventDefault();
      actions.onComposerSubmit();
    }
  });
  section.appendChild(textarea);

  if (state.composerNote) section.appendChild(el("p", "composer-note", state.composerNote));

  const controls = el("div", "composer-controls");
  const send = el("button", "btn btn-send", "发送") as HTMLButtonElement;
  send.type = "button";
  // #11: no real send IPC in 064; until SHEEP-066 wires the pipeline, Send is
  // natively disabled + contextual unavailable (never fakes success).
  send.disabled = !state.composerSendAvailable || draft.trim() === "";
  send.addEventListener("click", () => actions.onComposerSubmit());
  controls.appendChild(send);
  if (!state.composerSendAvailable) {
    controls.appendChild(el("span", "composer-unavailable", "发送功能暂不可用"));
  }
  section.appendChild(controls);
  root.appendChild(section);
}

