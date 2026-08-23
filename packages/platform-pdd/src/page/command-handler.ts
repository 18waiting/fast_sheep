// M7 page command handler (clean-room). Finite allowlist only.
// Generic remote-control commands are intentionally not implemented.
import type { DomDocument } from "../dom/dom-types.js";
import { domHealth } from "../dom/dom-health.js";
import { readMessages } from "../dom/message-reader.js";
import { readComposerState, sendImage, sendText } from "../dom/composer-driver.js";
import { executeTransfer } from "../dom/transfer-driver.js";
import { PDD_SELECTOR_PROFILE } from "../selector-profile.js";
import type { PddPageCommand, PddPageCommandResult } from "../types.js";

const ALLOWED_TYPES = new Set(["scan", "send_text", "send_image", "transfer", "focus_conversation", "health"]);

export function handleCommand(doc: DomDocument, command: PddPageCommand): PddPageCommandResult {
  if (!ALLOWED_TYPES.has(command.type)) {
    return { command_id: command.command_id, ok: false, error: "platform.invalid_command" };
  }
  const health = domHealth(doc, PDD_SELECTOR_PROFILE);
  switch (command.type) {
    case "health": {
      return { command_id: command.command_id, ok: true, result: { ready: health.ready, reason: health.ready ? undefined : health.reason } };
    }
    case "scan": {
      if (!health.ready) return { command_id: command.command_id, ok: false, error: "platform.dom_unavailable" };
      const messages = readMessages(doc, PDD_SELECTOR_PROFILE);
      return { command_id: command.command_id, ok: true, result: { messages } };
    }
    case "send_text": {
      if (!health.ready || !command.conversation_id || command.text === undefined) {
        return { command_id: command.command_id, ok: false, error: "platform.dom_unavailable" };
      }
      const result = sendText(doc, PDD_SELECTOR_PROFILE, command.conversation_id, command.text);
      if (!result.ok) return { command_id: command.command_id, ok: false, error: result.error };
      return { command_id: command.command_id, ok: true, result: { message_id: result.message_id } };
    }
    case "send_image": {
      if (!health.ready || !command.conversation_id || !command.asset_ref) {
        return { command_id: command.command_id, ok: false, error: "platform.dom_unavailable" };
      }
      const result = sendImage(doc, PDD_SELECTOR_PROFILE, command.conversation_id, command.asset_ref);
      if (!result.ok) return { command_id: command.command_id, ok: false, error: result.error };
      return { command_id: command.command_id, ok: true, result: { message_id: result.message_id } };
    }
    case "transfer": {
      if (!health.ready || !command.conversation_id || !command.target) {
        return { command_id: command.command_id, ok: false, error: "platform.dom_unavailable" };
      }
      const result = executeTransfer(doc, PDD_SELECTOR_PROFILE, command.target);
      if (!result.ok) {
        return { command_id: command.command_id, ok: false, error: result.error, result: { fallback_message: result.fallback_message } };
      }
      return { command_id: command.command_id, ok: true, result: { executed: true } };
    }
    case "focus_conversation": {
      return { command_id: command.command_id, ok: true, result: { conversation_id: command.conversation_id } };
    }
    default:
      return { command_id: command.command_id, ok: false, error: "platform.invalid_command" };
  }
}
