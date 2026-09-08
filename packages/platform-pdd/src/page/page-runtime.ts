// M7 PDD page runtime (clean-room, browser-safe).
// Runs inside the sandboxed PDD WebContentsView preload. Observes the seller page,
// scans/normalizes inbound messages, detects conversation changes + human replies,
// and executes finite-allowlist commands from trusted Main. No Node imports.
import type { DomDocument } from "../dom/dom-types.js";
import { domHealth } from "../dom/dom-health.js";
import { readConversation, listConversations } from "../dom/conversation-reader.js";
import { readMessages } from "../dom/message-reader.js";
import { detectHumanReply } from "../dom/takeover-detector.js";
import { PDD_SELECTOR_PROFILE } from "../selector-profile.js";
import { normalizeMessage } from "../message-normalizer.js";
import { MessageDeduplicator } from "../message-deduplicator.js";
import { handleCommand } from "./command-handler.js";
import { PageMutationObserver, type MutationObserverLike } from "./mutation-observer.js";
import { MiniEventEmitter } from "./event-emitter.js";
import type { PddPageCommand, PddPageCommandResult, PddPageEvent } from "../types.js";
import {
  buildPageReady, buildLoginRequired, buildDomUnsupported, buildConversationChanged,
  buildMessageReceived, buildHumanReplyDetected, buildSendAck, buildTransferAck,
} from "../dom/page-events.js";

export interface PageTransport {
  send(event: PddPageEvent): void;
  onCommand(handler: (command: PddPageCommand) => Promise<PddPageCommandResult> | PddPageCommandResult): () => void;
}

export interface PageRuntimeOptions {
  doc: DomDocument;
  sessionId: string;
  shopId: string;
  transport: PageTransport;
  now?: () => number;
  makeObserver?: (cb: () => void) => { observe(target: unknown, options: unknown): void; disconnect(): void };
}

export class PddPageRuntime {
  readonly events = new MiniEventEmitter<PddPageEvent>();
  private readonly dedup = new MessageDeduplicator(512);
  private readonly ackRegistry = new Map<string, number>();
  private lastConversationId: string | null = null;
  private lastMessageKeys = new Set<string>();
  private readonly observer: PageMutationObserver;
  private readonly now: () => number;
  private lastReadiness: "LOGIN_REQUIRED" | "READY" | "DOM_UNSUPPORTED" | null = null;

  constructor(private readonly options: PageRuntimeOptions) {
    this.now = options.now ?? (() => Date.now());
    const makeObserver =
      options.makeObserver ??
      ((cb: () => void) => {
        // Browser page runtime: real MutationObserver is a global constructor.
        const MO = (globalThis as { MutationObserver?: new (cb: () => void) => MutationObserverLike }).MutationObserver;
        if (!MO) throw new Error("MutationObserver unavailable");
        return new MO(cb);
      });
    this.observer = new PageMutationObserver(makeObserver, 80);
    this.observer.onScan = () => this.observeReadiness();
    options.transport.onCommand((command) => this.runCommand(command));
  }

  start(): void {
    const { doc } = this.options;
    this.observeReadiness();
    const root = doc.body;
    if (root) this.observer.start(root);
  }

  private observeReadiness(): void {
    const { doc, sessionId } = this.options;
    if (doc.querySelector("[data-fw-pdd-login]")) {
      if (this.lastReadiness !== "LOGIN_REQUIRED") {
        this.lastReadiness = "LOGIN_REQUIRED";
        this.emit(buildLoginRequired(sessionId));
      }
      return;
    }

    const health = domHealth(doc, PDD_SELECTOR_PROFILE);
    if (!health.ready) {
      if (this.lastReadiness !== "DOM_UNSUPPORTED") {
        this.lastReadiness = "DOM_UNSUPPORTED";
        this.emit(buildDomUnsupported(sessionId, health.reason));
      }
      return;
    }

    if (this.lastReadiness !== "READY") {
      this.lastReadiness = "READY";
      this.emit(buildPageReady(sessionId, "READY"));
      this.scan();
      return;
    }

    this.scan();
  }

  private emit(event: PddPageEvent): void {
    this.events.emit(event);
    this.options.transport.send(event);
  }

  scan(): void {
    const { doc, sessionId, shopId } = this.options;
    const conversation = readConversation(doc, PDD_SELECTOR_PROFILE);
    if (conversation.conversation_id && conversation.conversation_id !== this.lastConversationId) {
      this.lastConversationId = conversation.conversation_id;
      this.emit(buildConversationChanged(sessionId, shopId, conversation.conversation_id, conversation.buyer_id));
    }
    const messages = readMessages(doc, PDD_SELECTOR_PROFILE);
    const nowMs = this.now();
    // Deterministic DOM order (no async reordering). Only INBOUND messages are
    // emitted as buyer messages; outbound rows feed takeover detection.
    for (const raw of messages) {
      if (raw.direction === "outbound") continue;
      const normalized = normalizeMessage({
        shop_id: shopId,
        conversation_id: this.lastConversationId ?? conversation.conversation_id ?? "unknown",
        buyer_id: conversation.buyer_id,
        raw,
      });
      const key = normalized.platform_message_id ?? "";
      if (!key) continue;
      if (!this.dedup.observe(key)) continue;
      this.lastMessageKeys.add(key);
      this.emit(buildMessageReceived(sessionId, normalized));
    }

    // Human takeover detection (automated sends excluded via bounded ack registry).
    const acks = [...this.ackRegistry.entries()].map(([message_id, at_ms]) => ({ message_id, at_ms }));
    const signal = detectHumanReply(doc, PDD_SELECTOR_PROFILE, messages, acks, nowMs);
    if (signal.isHuman && this.lastConversationId) {
      this.emit(buildHumanReplyDetected(sessionId, shopId, this.lastConversationId, signal.message_id));
    }
    void listConversations;
  }

  async runCommand(command: PddPageCommand): Promise<PddPageCommandResult> {
    const { doc, sessionId, shopId } = this.options;
    const result = handleCommand(doc, command);
    if (command.type === "send_text") {
      if (result.ok && command.conversation_id) {
        const mid = (result.result?.message_id as string | undefined) ?? command.command_id;
        this.ackRegistry.set(mid, this.now());
        if (this.ackRegistry.size > 128) {
          const oldest = this.ackRegistry.keys().next().value;
          if (oldest !== undefined) this.ackRegistry.delete(oldest);
        }
      }
      this.emit(buildSendAck(sessionId, shopId, command.conversation_id ?? "", command.command_id, result.ok, result.error));
    }
    if (command.type === "transfer") {
      this.emit(buildTransferAck(sessionId, shopId, command.conversation_id ?? "", command.command_id, result.ok, result.error));
    }
    return result;
  }

  stop(): void {
    this.observer.stop();
  }
}
