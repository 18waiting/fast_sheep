// M7 transfer driver (clean-room). Executes ONLY an explicit TransferDecision target.
import type { DomDocument } from "./dom-types.js";
import { selector, type SelectorProfile } from "../selector-profile.js";
import type { TransferExecutionResult } from "../types.js";

/**
 * Execute transfer steps 1-3 (open dialog -> select provided target -> confirm).
 * Never chooses a target; never applies working-hour/fallback business policy.
 */
export function executeTransfer(doc: DomDocument, profile: SelectorProfile, target: string): TransferExecutionResult {
  const openSel = selector(profile, "transfer.open");
  const targetListSel = selector(profile, "transfer.target-list");
  const targetItemSel = selector(profile, "transfer.target-item");
  const confirmSel = selector(profile, "transfer.confirm");

  if (!openSel || !targetListSel || !targetItemSel || !confirmSel) {
    return { ok: false, executed: false, error: "platform.dom_unavailable" };
  }
  const open = doc.querySelector(openSel.primary);
  const targetList = doc.querySelector(targetListSel.primary);
  if (!open || !targetList) return { ok: false, executed: false, error: "platform.dom_unavailable" };

  // Step 1: open transfer dialog.
  if (typeof open.click === "function") open.click();
  const targetListAfterOpen = doc.querySelector(targetListSel.primary) ?? targetList;

  // Step 2: find the EXPLICIT target only. No fallback target selection.
  let targetNode = null;
  for (const node of targetListAfterOpen.querySelectorAll(targetItemSel.primary)) {
    if (node.getAttribute("data-target") === target || node.textContent?.trim() === target) {
      targetNode = node;
      break;
    }
  }
  if (!targetNode) {
    // No available target: never choose another silently.
    return { ok: false, executed: false, error: "platform.transfer_target_unavailable", fallback_message: FALLBACK_TRANSFER_TEXT };
  }

  // Step 3: confirm transfer.
  if (typeof targetNode.click === "function") targetNode.click();
  const confirm = doc.querySelector(confirmSel.primary);
  if (!confirm) return { ok: false, executed: false, error: "platform.dom_unavailable" };
  if (typeof confirm.click === "function") confirm.click();
  return { ok: true, executed: true };
}

/** 转接放弃话术 fallback text. Placeholder constant matching the frozen fixture token. */
export const FALLBACK_TRANSFER_TEXT = "<转接放弃话术>";
