// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M5 conversation orchestrator: Main-side authority for message receipt, generation
// tokens, suggestion lifecycle, review/full-auto modes, countdown, manual send,
// NO_SAVE, invalidation, stale rejection, pre-send revalidation, takeover, send
// serialization, segmented send, and feedback intent emission.

import type {
  AiEngineClient,
  AiEngineResult,
  GenerateReplyResult,
  TransferDecision,
} from "../ports/ai-engine-client.js";
import type { Clock } from "../ports/clock.js";
import type { EventBus } from "../ports/event-bus.js";
import type { FeedbackSink, FeedbackIntent } from "../ports/feedback-sink.js";
import type { PlatformAdapter, SendAttempt } from "../ports/platform-adapter.js";
import type { ConversationRepositoryPort } from "../ports/conversation-repository-port.js";
import { CountdownController } from "./countdown-controller.js";
import { ManualTakeoverController } from "./manual-takeover-controller.js";
import { PreSendController } from "./pre-send-controller.js";
import { SegmentedSender, type ScheduleFn } from "./segmented-sender.js";
import { SendSerializer } from "./send-serializer.js";
import { SuggestionManager } from "./suggestion-manager.js";
import { CountdownPolicy } from "../policies/countdown-policy.js";
import { FeedbackIntentPolicy } from "../policies/feedback-intent-policy.js";
import { PreSendRevalidationPolicy } from "../policies/pre-send-revalidation-policy.js";
import { ReviewModePolicy } from "../policies/review-mode-policy.js";
import { SegmentedSendPolicy } from "../policies/segmented-send-policy.js";
import { TakeoverBreakerPolicy } from "../policies/takeover-breaker-policy.js";
import {
  createConversationRuntimeState,
  type ConversationRuntimeState,
  type SendRequest,
} from "../state/conversation-runtime-state.js";
import type {
  ConversationSnapshot,
  DecisionRecord,
  OrchestratorSnapshot,
} from "../state/orchestrator-state.js";
import type { SuggestionState } from "../state/suggestion-state.js";

export interface BuyerMessage {
  message_id?: string;
  buyer?: string;
  content?: string;
  [key: string]: unknown;
}

export interface OrchestratorPolicies {
  reviewModePolicy: ReviewModePolicy;
  countdownPolicy: CountdownPolicy;
  takeoverBreakerPolicy: TakeoverBreakerPolicy;
  preSendRevalidationPolicy: PreSendRevalidationPolicy;
  segmentedSendPolicy: SegmentedSendPolicy;
  feedbackIntentPolicy: FeedbackIntentPolicy;
}

export interface OrchestratorOptions {
  aiEngineClient: AiEngineClient;
  platformAdapter: PlatformAdapter;
  clock: Clock;
  eventBus: EventBus;
  feedbackSink: FeedbackSink;
  repository: ConversationRepositoryPort;
  policies?: Partial<OrchestratorPolicies>;
  segmentIntervalMs?: number;
  countdownTickMs?: number;
  schedule?: ScheduleFn;
  initialState?: Record<string, Record<string, unknown>>;
}

interface SendFeedbackOptions {
  feedbackClass?: "MANUAL" | "AUTO";
  trust?: string | null;
  recordFeedback?: boolean;
  decisionBeforeSend?: DecisionRecord | null;
}

export class ConversationOrchestrator {
  private readonly aiEngineClient: AiEngineClient;
  private readonly platformAdapter: PlatformAdapter;
  private readonly clock: Clock;
  private readonly eventBus: EventBus;
  private readonly feedbackSink: FeedbackSink;
  private readonly repository: ConversationRepositoryPort;

  private readonly reviewModePolicy: ReviewModePolicy;
  private readonly takeoverBreakerPolicy: TakeoverBreakerPolicy;
  private readonly preSendRevalidationPolicy: PreSendRevalidationPolicy;
  private readonly segmentedSendPolicy: SegmentedSendPolicy;
  private readonly feedbackIntentPolicy: FeedbackIntentPolicy;

  private readonly suggestionManager: SuggestionManager;
  private readonly countdownController: CountdownController;
  private readonly manualTakeoverController: ManualTakeoverController;
  private readonly preSendController: PreSendController;
  private readonly sendSerializer: SendSerializer;
  private readonly segmentedSender: SegmentedSender;

  private readonly conversations = new Map<string, ConversationRuntimeState>();
  private readonly decisions: DecisionRecord[] = [];
  private focusedShopId: string | null = null;

  private readonly segmentIntervalMs: number;
  private readonly countdownTickMs: number;

  constructor(options: OrchestratorOptions) {
    this.aiEngineClient = options.aiEngineClient;
    this.platformAdapter = options.platformAdapter;
    this.clock = options.clock;
    this.eventBus = options.eventBus;
    this.feedbackSink = options.feedbackSink;
    this.repository = options.repository;

    this.reviewModePolicy = options.policies?.reviewModePolicy ?? new ReviewModePolicy();
    this.preSendRevalidationPolicy = options.policies?.preSendRevalidationPolicy ?? new PreSendRevalidationPolicy();
    void options.policies?.countdownPolicy;
    this.segmentedSendPolicy = options.policies?.segmentedSendPolicy ?? new SegmentedSendPolicy();
    this.feedbackIntentPolicy = options.policies?.feedbackIntentPolicy ?? new FeedbackIntentPolicy();
    this.takeoverBreakerPolicy = options.policies?.takeoverBreakerPolicy ?? new TakeoverBreakerPolicy(2, 60000, options.clock);

    this.suggestionManager = new SuggestionManager(options.clock);
    this.countdownController = new CountdownController(options.countdownTickMs ?? 1000);
    this.manualTakeoverController = new ManualTakeoverController();
    this.preSendController = new PreSendController(options.aiEngineClient, options.clock, this.preSendRevalidationPolicy);
    this.sendSerializer = new SendSerializer();

    this.segmentIntervalMs = options.segmentIntervalMs ?? 0;
    this.countdownTickMs = options.countdownTickMs ?? 1000;

    this.segmentedSender = new SegmentedSender({
      clock: options.clock,
      policy: this.segmentedSendPolicy,
      schedule: options.schedule,
      sendText: (shopId, conversationId, segments) =>
        this.platformAdapter.sendText(shopId, conversationId, segments),
    });

    for (const [seedKey, seed] of Object.entries(options.initialState ?? {})) {
      const separatorIndex = seedKey.indexOf("\u0000");
      if (separatorIndex >= 0) {
        const shopId = seedKey.slice(0, separatorIndex);
        const conversationId = seedKey.slice(separatorIndex + 1);
        this.seedConversation(shopId, conversationId, seed);
      } else {
        const shopId = typeof seed.shop_id === "string" ? seed.shop_id : "s1";
        this.seedConversation(shopId, seedKey, seed);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public orchestration surface
  // ---------------------------------------------------------------------------

  async onBuyerMessage(shopId: string, conversationId: string, message: BuyerMessage): Promise<void> {
    const state = this.ensureState(shopId, conversationId);
    const generation = state.generationToken.next();
    const invalidated = state.suggestion !== null;

    if (state.suggestion && state.suggestion.status === "pending") {
      this.suggestionManager.invalidate(state.suggestion);
    }
    state.suggestion = null;
    this.countdownController.cancel(state);
    state.aiInflight = true;
    state.lastMessageId = typeof message.message_id === "string" ? message.message_id : undefined;

    if (this.isBusy() && !this.sendSerializer.isSending(this.sendSerializer.key(shopId, conversationId))) {
      this.recordDecision({ decision: "concurrent_ok", shop_id: shopId, conversation_id: conversationId });
    }
    this.emit("BuyerMessageReceived", {
      shop_id: shopId,
      conversation_id: conversationId,
      message_id: message.message_id,
      buyer: message.buyer,
      content: message.content,
    });

    if (invalidated) {
      this.recordDecision({ decision: "invalidate_suggestion", generation, conversation_id: conversationId, shop_id: shopId });
    }

    const result = await this.aiEngineClient.generateReply({
      shopId,
      conversationId,
      message: typeof message.content === "string" ? message.content : (typeof message.message === "string" ? message.message : ""),
      generation,
      message_id: message.message_id,
      buyer: message.buyer,
    });

    state.aiInflight = false;
    await this.processAiResult(state, result, generation);
  }

  async onAiResult(shopId: string, conversationId: string, result: AiEngineResult): Promise<void> {
    const state = this.ensureState(shopId, conversationId);
    await this.processAiResult(state, result, result.generation ?? state.generationToken.current());
  }

  async onManualSend(shopId: string, conversationId: string, key: string): Promise<void> {
    const state = this.ensureState(shopId, conversationId);
    if (!state.suggestion || state.suggestion.status !== "pending") {
      return;
    }

    const feedbackClass = this.feedbackIntentPolicy.classify(state.mode, key);

    if (feedbackClass === "NO_SAVE") {
      this.recordDecision({ decision: "send_no_save", conversation_id: conversationId, shop_id: shopId });
      await this.sendSuggestion(state, { recordFeedback: false });
      return;
    }

    // Pre-send revalidation is gated on a NEW buyer message since the suggestion was
    // generated (发送前检查新消息). Without a new message the pending suggestion is sent as-is.
    const current = await this.platformAdapter.getCurrentConversationState?.(shopId, conversationId);
    const hasNewMessage = current?.hasNewMessage === true;
    if (hasNewMessage && this.preSendRevalidationPolicy.shouldRevalidate(state.mode, key)) {
      const revalidation = await this.preSendController.revalidate(state, shopId, conversationId);
      if (revalidation.regenerated) {
        this.recordDecision({
          decision: "regenerate_before_send",
          generation: revalidation.generation,
          conversation_id: conversationId,
          shop_id: shopId,
        });
        await this.persistAiTurn(state);
        return;
      }
    }

    this.recordDecision({
      decision: "send",
      trust: "HUMAN_CONFIRMED",
      conversation_id: conversationId,
      shop_id: shopId,
    });
    await this.sendSuggestion(state, {
      feedbackClass: "MANUAL",
      trust: "HUMAN_CONFIRMED",
      recordFeedback: true,
    });
  }

  async onCancel(shopId: string, conversationId: string): Promise<void> {
    const state = this.ensureState(shopId, conversationId);
    if (state.suggestion && state.suggestion.status === "pending") {
      this.suggestionManager.cancel(state.suggestion);
    }
    this.countdownController.cancel(state);
    this.recordDecision({ decision: "cancelled", conversation_id: conversationId, shop_id: shopId });
  }

  async onSetMode(shopId: string, conversationId: string, mode: "human_review" | "full_auto"): Promise<void> {
    const state = this.ensureState(shopId, conversationId);
    const previousMode = state.mode;
    state.mode = mode;

    if (previousMode === "human_review" && mode === "full_auto" && state.suggestion?.status === "pending") {
      this.recordDecision({
        decision: "pending_suggestion_sent",
        conversation_id: conversationId,
        shop_id: shopId,
      });
      await this.sendSuggestion(state, {
        feedbackClass: "AUTO",
        trust: "AUTO",
        recordFeedback: true,
      });
    }
  }

  async onHumanTakeover(shopId: string, conversationId: string): Promise<void> {
    const state = this.ensureState(shopId, conversationId);
    this.manualTakeoverController.takeover(state);
    this.recordDecision({ decision: "takeover", conversation_id: conversationId, shop_id: shopId });
    this.emit("HumanTakeover", {
      conversation_id: conversationId,
      shop_id: shopId,
    });
  }

  onFocusShop(shopId: string): void {
    if (this.focusedShopId !== shopId) {
      this.focusedShopId = shopId;
      this.recordDecision({ decision: "focus_switch", shop_id: shopId });
    }
  }

  async onSendRequest(shopId: string, conversationId: string, request?: Partial<SendRequest>): Promise<void> {
    const state = this.ensureState(shopId, conversationId);
    const reply = request?.reply ?? state.suggestion?.reply ?? "";
    const sendRequest: SendRequest = {
      shopId,
      conversationId,
      reply,
      generation: request?.generation ?? state.generationToken.current(),
      mode: state.mode,
    };

    const key = this.sendSerializer.key(shopId, conversationId);
    const status = this.sendSerializer.enqueue(key, sendRequest);
    state.sendQueue = this.sendSerializer.queue(key);
    state.sending = this.sendSerializer.isSending(key);

    if (status === "serialized_wait") {
      this.recordDecision({ decision: "serialized_wait", conversation_id: conversationId, shop_id: shopId });
      return;
    }

    await this.drainQueue(key, state);
  }

  onDequeueNext(shopId: string, conversationId: string): void {
    const state = this.ensureState(shopId, conversationId);
    const key = this.sendSerializer.key(shopId, conversationId);
    const request = this.sendSerializer.dequeue(key);
    state.sendQueue = this.sendSerializer.queue(key);
    state.sending = this.sendSerializer.isSending(key);
    if (request) {
      this.recordDecision({ decision: "dequeue_next", conversation_id: conversationId, shop_id: shopId });
    }
  }

  async onCountdownElapsed(shopId: string, conversationId: string, elapsedMs: number): Promise<void> {
    const state = this.ensureState(shopId, conversationId);
    if (!state.countdown.enabled || !state.suggestion || state.suggestion.status !== "pending") {
      return;
    }
    const result = this.countdownController.elapse(state, elapsedMs);
    if (result.reachedZero) {
      this.recordDecision({
        decision: "auto_send",
        trust: "AUTO",
        conversation_id: conversationId,
        shop_id: shopId,
      });
      await this.sendSuggestion(state, {
        feedbackClass: "AUTO",
        trust: "AUTO",
        recordFeedback: true,
      });
    }
  }

  isBusy(shopId?: string): boolean {
    for (const state of this.conversations.values()) {
      if (shopId && state.shopId !== shopId) {
        continue;
      }
      const key = this.sendSerializer.key(state.shopId, state.conversationId);
      if (this.sendSerializer.isSending(key)) {
        return true;
      }
    }
    return false;
  }

  getFocusedShopId(): string | null {
    return this.focusedShopId;
  }

  decisionsSnapshot(): DecisionRecord[] {
    return [...this.decisions];
  }

  /** Test/setup seam: seed a conversation with fixture-style state. */
  seedConversation(shopId: string, conversationId: string, seed: Record<string, unknown>): void {
    const state = this.ensureState(shopId, conversationId);

    if (typeof seed.mode === "string") {
      state.mode = seed.mode === "full_auto" ? "full_auto" : "human_review";
    }
    if (typeof seed.current_generation === "number") {
      state.generationToken.set(seed.current_generation);
    }
    if (typeof seed.last_message_id === "string") {
      state.lastMessageId = seed.last_message_id;
    }

    if (seed.suggestion && typeof seed.suggestion === "object") {
      const s = seed.suggestion as Record<string, unknown>;
      const generation = typeof s.generation === "number" ? s.generation : state.generationToken.current();
      state.suggestion = this.suggestionManager.create(
        typeof s.reply === "string" ? s.reply : "亲,有的~",
        generation,
        state.mode,
        (s.decision as TransferDecision | undefined) ?? undefined,
      );
    } else if (seed.pending_suggestion === true) {
      state.suggestion = this.suggestionManager.create("亲,有的~", state.generationToken.current(), state.mode);
    }

    if (seed.countdown && typeof seed.countdown === "object") {
      const c = seed.countdown as Record<string, unknown>;
      state.countdown.enabled = c.enabled !== false;
      state.countdown.remainingTicks = typeof c.remaining_ticks === "number" ? c.remaining_ticks : 0;
      state.countdown.tickMs = typeof c.tick_ms === "number" ? c.tick_ms : this.countdownTickMs;
    }

    if (typeof seed.sending === "boolean") {
      const key = this.sendSerializer.key(shopId, conversationId);
      state.sending = seed.sending;
      this.sendSerializer.setSending(key, seed.sending);
    }

    if (Array.isArray(seed.queue)) {
      const key = this.sendSerializer.key(shopId, conversationId);
      const requests: SendRequest[] = seed.queue.map((conversationIdValue) => ({
        shopId,
        conversationId: typeof conversationIdValue === "string" ? conversationIdValue : conversationId,
        reply: "",
        generation: state.generationToken.current(),
        mode: state.mode,
      }));
      this.sendSerializer.seedQueue(key, requests);
      state.sendQueue = this.sendSerializer.queue(key);
    }

    if (typeof seed.consecutive_replies === "number") {
      state.breaker.consecutiveReplies = seed.consecutive_replies;
    }
    if (typeof seed.first_reply_at === "number") {
      state.breaker.firstReplyAt = seed.first_reply_at;
    }
    if (typeof seed.ai_inflight === "boolean") {
      state.aiInflight = seed.ai_inflight;
    }
  }

  snapshot(): OrchestratorSnapshot;
  snapshot(shopId: string): ConversationSnapshot[];
  snapshot(shopId: string, conversationId: string): ConversationSnapshot;
  snapshot(shopId?: string, conversationId?: string): OrchestratorSnapshot | ConversationSnapshot[] | ConversationSnapshot {
    if (shopId && conversationId) {
      return this.toSnapshot(this.ensureState(shopId, conversationId));
    }
    if (shopId) {
      const list: ConversationSnapshot[] = [];
      for (const state of this.conversations.values()) {
        if (state.shopId === shopId) {
          list.push(this.toSnapshot(state));
        }
      }
      return list;
    }
    return {
      focusedShopId: this.focusedShopId,
      decisions: [...this.decisions],
      conversations: [...this.conversations.values()].map((state) => this.toSnapshot(state)),
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private ensureState(shopId: string, conversationId: string): ConversationRuntimeState {
    const key = this.sendSerializer.key(shopId, conversationId);
    let state = this.conversations.get(key);
    if (!state) {
      state = createConversationRuntimeState(shopId, conversationId);
      this.conversations.set(key, state);
    }
    return state;
  }

  private async processAiResult(state: ConversationRuntimeState, result: GenerateReplyResult, fallbackGeneration: number): Promise<void> {
    const generation = (result as AiEngineResult).generation ?? fallbackGeneration;

    if (generation < state.generationToken.current()) {
      this.recordDecision({
        decision: "ignore_stale",
        generation,
        conversation_id: state.conversationId,
        shop_id: state.shopId,
      });
      return;
    }

    if (typeof result.reply !== "string" || result.reply.length === 0) {
      return;
    }

    await this.applyGeneratedReply(state, result.reply, generation, result.decision);
  }

  private async applyGeneratedReply(
    state: ConversationRuntimeState,
    reply: string,
    generation: number,
    decision?: TransferDecision,
  ): Promise<void> {
    state.suggestion = this.suggestionManager.create(reply, generation, state.mode, decision);
    this.recordDecision({
      decision: this.reviewModePolicy.suggestionDecision(state.mode),
      mode: state.mode,
      generation,
      conversation_id: state.conversationId,
      shop_id: state.shopId,
    });
    this.emit("SuggestionReady", {
      conversation_id: state.conversationId,
      shop_id: state.shopId,
      generation,
      mode: state.mode,
      reply,
    });

    if (decision?.requested) {
      this.platformAdapter.onTransfer?.(decision);
    }

    await this.persistAiTurn(state);

    if (this.reviewModePolicy.isFullAuto(state.mode)) {
      await this.sendSuggestion(state, {
        feedbackClass: "AUTO",
        trust: "AUTO",
        recordFeedback: true,
      });
    }
  }

  private async sendSuggestion(state: ConversationRuntimeState, options: SendFeedbackOptions): Promise<void> {
    const suggestion = state.suggestion;
    if (!suggestion || suggestion.status !== "pending") {
      return;
    }

    const feedbackClass = options.feedbackClass;
    if (options.recordFeedback && feedbackClass) {
      const intent: FeedbackIntent = {
        class: feedbackClass,
        trust: options.trust ?? "",
        conversationId: state.conversationId,
        shopId: state.shopId,
        mode: state.mode,
        reply: suggestion.reply,
      };
      this.feedbackSink.record(intent);
    }

    const request: SendRequest = {
      shopId: state.shopId,
      conversationId: state.conversationId,
      reply: suggestion.reply,
      generation: suggestion.generation,
      mode: state.mode,
    };

    const key = this.sendSerializer.key(state.shopId, state.conversationId);
    const status = this.sendSerializer.enqueue(key, request);
    state.sendQueue = this.sendSerializer.queue(key);
    state.sending = this.sendSerializer.isSending(key);

    if (status === "serialized_wait") {
      this.recordDecision({
        decision: "serialized_wait",
        conversation_id: state.conversationId,
        shop_id: state.shopId,
      });
      return;
    }

    await this.drainQueue(key, state);
  }

  private async drainQueue(key: string, state: ConversationRuntimeState): Promise<void> {
    let first = true;
    while (true) {
      const request = this.sendSerializer.dequeue(key);
      state.sendQueue = this.sendSerializer.queue(key);
      state.sending = this.sendSerializer.isSending(key);
      if (!request) {
        break;
      }
      if (!first) {
        this.recordDecision({
          decision: "dequeue_next",
          conversation_id: request.conversationId,
          shop_id: request.shopId,
        });
      }
      first = false;
      await this.performSend(request);
      this.sendSerializer.markDone(key);
      state.sendQueue = this.sendSerializer.queue(key);
      state.sending = this.sendSerializer.isSending(key);
    }
  }

  private async performSend(request: SendRequest): Promise<void> {
    const { shopId, conversationId, reply } = request;
    this.emit("SendStarted", {
      conversation_id: conversationId,
      shop_id: shopId,
      generation: request.generation,
    });

    let attempt = await this.segmentedSender.send(shopId, conversationId, reply, this.segmentIntervalMs);

    if (!attempt.ok) {
      this.emit("SendFailed", {
        conversation_id: conversationId,
        shop_id: shopId,
        error: attempt.error,
      });
      this.recordDecision({
        decision: "refill_on_failure",
        conversation_id: conversationId,
        shop_id: shopId,
      });

      // Refill/retry exactly once before surfacing the failure.
      this.emit("SendStarted", {
        conversation_id: conversationId,
        shop_id: shopId,
        generation: request.generation,
      });
      attempt = await this.segmentedSender.send(shopId, conversationId, reply, this.segmentIntervalMs);
      if (!attempt.ok) {
        this.emit("SendFailed", {
          conversation_id: conversationId,
          shop_id: shopId,
          error: attempt.error,
        });
        return;
      }
    }

    this.emit("SendCompleted", {
      conversation_id: conversationId,
      shop_id: shopId,
      generation: request.generation,
    });

    const state = this.ensureState(shopId, conversationId);
    if (state.suggestion && state.suggestion.status === "pending") {
      this.suggestionManager.markSent(state.suggestion);
    }
  }

  private async persistAiTurn(state: ConversationRuntimeState): Promise<void> {
    const suggestion = state.suggestion;
    if (!suggestion) {
      return;
    }
    await this.repository.appendTurn({
      shopId: state.shopId,
      conversationId: state.conversationId,
      role: "ai",
      content: suggestion.reply,
      generation: suggestion.generation,
    });
  }

  private recordDecision(decision: DecisionRecord): void {
    this.decisions.push(decision);
  }

  private emit(event: string, payload?: Record<string, unknown>): void {
    this.eventBus.emit(event, payload);
  }

  private toSnapshot(state: ConversationRuntimeState): ConversationSnapshot {
    return {
      shopId: state.shopId,
      conversationId: state.conversationId,
      mode: state.mode,
      generation: state.generationToken.current(),
      suggestion: state.suggestion ? { ...state.suggestion } : null,
      countdown: { ...state.countdown },
      sending: state.sending,
      sendQueue: [...state.sendQueue],
      aiInflight: state.aiInflight,
      breaker: { ...state.breaker },
      lastMessageId: state.lastMessageId,
    };
  }
}