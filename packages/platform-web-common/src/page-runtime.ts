// M8 generic page runtime (platform-neutral; browser-safe).
import type { DomDocument, NormalizedInboundMessage, PlatformPageCommand, PlatformPageCommandResult, PlatformPageEvent } from "./types.js";
import { domHealth, readConversation, readMessages, detectHumanReply } from "./dom-drivers.js";
import { MessageDeduplicator } from "./message-deduplicator.js";
import { SendAckRegistry } from "./send-ack-registry.js";
import { dispatchCommand, type CommandHandlers } from "./dom-command.js";
import { MiniEmitter } from "./mini-emitter.js";
import { normalizeMessage, type NormalizeInput } from "./normalize.js";
import {
  buildPageReady, buildLoginRequired, buildDomUnsupported, buildConversationChanged,
  buildMessageReceived, buildHumanReplyDetected, buildSendAck, buildTransferAck,
} from "./dom-event.js";

export interface PageTransport {
  send(event: PlatformPageEvent): void;
  onCommand(handler: (command: PlatformPageCommand) => Promise<PlatformPageCommandResult> | PlatformPageCommandResult): () => void;
}

export interface PageObserverLike {
  observe(target: unknown, options: unknown): void;
  disconnect(): void;
}

export interface PageRuntimeOptions {
  platform: string;
  doc: DomDocument;
  sessionId: string;
  shopId: string;
  profile: { version: string; platform: string; entries: unknown[] };
  transport: PageTransport;
  handlers: CommandHandlers;
  now?: () => number;
  makeObserver?: (cb: () => void) => PageObserverLike;
  debounceMs?: number;
}

export class PlatformPageRuntime {
  private readonly dedup = new MessageDeduplicator(512);
  private readonly acks = new SendAckRegistry();
  private lastConversationId: string | null = null;
  private observer: PageObserverLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly now: () => number;
  private readonly profile: { version: string; platform: string; entries: unknown[] };

  constructor(private readonly options: PageRuntimeOptions) {
    this.now = options.now ?? (() => Date.now());
    this.profile = { version: "1.0", platform: options.platform, entries: options.profile.entries };
    options.transport.onCommand((command) => this.runCommand(command));
  }

  start(): void {
    const { doc, sessionId, shopId } = this.options;
    const health = domHealth(doc, this.profile as never);
    if (doc.querySelector("[data-fw-" + this.options.platform + "-login]")) {
      this.emit(buildLoginRequired(sessionId));
      return;
    }
    if (!health.ready) {
      this.emit(buildDomUnsupported(sessionId, health.reason));
      return;
    }
    this.emit(buildPageReady(sessionId, "READY"));
    this.scan();
    const root = doc.body;
    if (root) this.startObserving(root);
  }

  private startObserving(root: DomElementLike): void {
    const makeObserver = this.options.makeObserver ?? ((cb: () => void) => {
      const MO = (globalThis as { MutationObserver?: new (cb: () => void) => PageObserverLike }).MutationObserver;
      if (!MO) throw new Error("MutationObserver unavailable");
      return new MO(cb);
    });
    this.observer = makeObserver(() => this.schedule());
    this.observer.observe(root, { childList: true, subtree: true, characterData: true });
  }

  private schedule(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.scan();
    }, this.options.debounceMs ?? 80);
  }

  private emit(event: PlatformPageEvent): void {
    this.options.transport.send(event);
  }

  scan(): void {
    const { doc, sessionId, shopId, platform } = this.options;
    const conversation = readConversation(doc, this.profile as never);
    if (conversation.conversation_id && conversation.conversation_id !== this.lastConversationId) {
      this.lastConversationId = conversation.conversation_id;
      this.emit(buildConversationChanged(sessionId, shopId, conversation.conversation_id, conversation.buyer_id));
    }
    const messages = readMessages(doc, this.profile as never);
    const nowMs = this.now();
    for (const raw of messages) {
      if (raw.direction === "outbound") continue;
      const normalized = normalizeMessage({ platform, shop_id: shopId, conversation_id: this.lastConversationId ?? conversation.conversation_id ?? "unknown", buyer_id: conversation.buyer_id, raw });
      const key = normalized.platform_message_id ?? "";
      if (!key) continue;
      if (!this.dedup.observe(key)) continue;
      this.emit(buildMessageReceived(sessionId, normalized));
    }
    const signal = detectHumanReply(doc, this.profile as never, messages, this.acks.recent(nowMs), nowMs);
    if (signal.isHuman && this.lastConversationId) {
      this.emit(buildHumanReplyDetected(sessionId, shopId, this.lastConversationId, signal.message_id));
    }
  }

  async runCommand(command: PlatformPageCommand): Promise<PlatformPageCommandResult> {
    const { doc, sessionId, shopId } = this.options;
    const result = dispatchCommand(command, this.options.handlers);
    if (command.type === "send_text") {
      if (result.ok && command.conversation_id) {
        const mid = (result.result?.message_id as string | undefined) ?? command.command_id;
        this.acks.record(mid, this.now());
      }
      this.emit(buildSendAck(sessionId, shopId, command.conversation_id ?? "", command.command_id, result.ok, result.error));
    }
    if (command.type === "transfer") {
      this.emit(buildTransferAck(sessionId, shopId, command.conversation_id ?? "", command.command_id, result.ok, result.error));
    }
    return result;
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

interface DomElementLike {
  querySelector(sel: string): unknown;
}
