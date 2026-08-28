// SHEEP-063/064 Conversation Main region composition (REPAIR #2).
// The Conversation Main region stacks, in order:
//   1. conversation-panel   (identity header, clean-room baseline)
//   2. message-timeline     (primary content surface, SHEEP-063)
//   3. composer             (reply surface BELOW the timeline, SHEEP-064)
// Each surface is rendered into its OWN sub-container so that each component's
// internal clear(root) can never wipe a sibling surface (the REPAIR root cause:
// three render functions sharing one host each cleared the host, so only the last
// surface survived). Timeline and Composer must coexist; Composer must not
// replace/cover the Timeline.
import type { UiState } from "../state/view-model.js";
import type { WorkbenchActions } from "./actions.js";
import { renderConversationPanel } from "./conversation-panel.js";
import { renderMessageTimeline } from "./message-timeline.js";
import { renderComposer } from "./composer.js";
import { clear, el } from "./dom.js";

export function renderConversationRegion(root: HTMLElement, state: UiState, actions: WorkbenchActions): void {
  clear(root);

  const panelHost = el("div", "conversation-panel-host");
  renderConversationPanel(panelHost, state);
  root.appendChild(panelHost);

  // SHEEP-063: Message Timeline is the Conversation Main primary content surface.
  const timelineHost = el("div", "conversation-timeline-host");
  renderMessageTimeline(timelineHost, state);
  root.appendChild(timelineHost);

  // SHEEP-064: Composer is the reply surface BELOW the Timeline (never replacing it).
  const composerHost = el("div", "composer-host");
  renderComposer(composerHost, state, actions);
  root.appendChild(composerHost);
}
