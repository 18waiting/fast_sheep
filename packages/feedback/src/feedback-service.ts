// M9 FeedbackService (clean-room). Main single-writer for FeedbackRecord; applies
// knowledge effects through the worker client with durable, idempotent, bounded retry.
import type { FeedbackIntent } from "@fastwork/orchestrator";
import { effectForIntent, isNoSave } from "./feedback-effect-policy.js";
import { FeedbackIdempotency } from "./feedback-idempotency.js";
import { FeedbackRetryPolicy } from "./feedback-retry-policy.js";
import { FeedbackError, FEEDBACK_ERROR_CODES } from "./errors.js";
import type { FeedbackRepositoryPort } from "./ports/feedback-repository-port.js";
import type { KnowledgeFeedbackClient } from "./ports/knowledge-feedback-client.js";
import { SystemClock, type Clock } from "./ports/clock.js";
import { NoopFeedbackEventBus, type FeedbackEventBus } from "./ports/event-bus.js";
import type { FeedbackEffectStatusView, KnowledgeEffectRequest } from "./types.js";

export interface FeedbackServiceOptions {
  repository: FeedbackRepositoryPort;
  knowledgeClient: KnowledgeFeedbackClient;
  clock?: Clock;
  eventBus?: FeedbackEventBus;
  retryPolicy?: FeedbackRetryPolicy;
  recordIdFactory?: (intent: FeedbackIntent) => string;
}

export class FeedbackService {
  private readonly repository: FeedbackRepositoryPort;
  private readonly knowledgeClient: KnowledgeFeedbackClient;
  private readonly clock: Clock;
  private readonly eventBus: FeedbackEventBus;
  private readonly retryPolicy: FeedbackRetryPolicy;
  private readonly idempotency: FeedbackIdempotency;
  private readonly recordIdFactory: (intent: FeedbackIntent) => string;

  constructor(options: FeedbackServiceOptions) {
    this.repository = options.repository;
    this.knowledgeClient = options.knowledgeClient;
    this.clock = options.clock ?? new SystemClock();
    this.eventBus = options.eventBus ?? new NoopFeedbackEventBus();
    this.retryPolicy = options.retryPolicy ?? new FeedbackRetryPolicy();
    this.idempotency = new FeedbackIdempotency();
    this.recordIdFactory = options.recordIdFactory ?? ((intent) => "fr-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8));
  }

  /** Handle a FeedbackIntent: write FeedbackRecord (unless NO_SAVE) + apply effect. */
  async handle(intent: FeedbackIntent): Promise<FeedbackEffectStatusView> {
    const effect = effectForIntent(intent);
    if (isNoSave(intent)) {
      // NO_SAVE: zero worker knowledge calls, zero record writes.
      this.eventBus.emit("feedback.no_save", { class: intent.class });
      return { record_id: "", effect_status: "APPLIED", attempts: 0 };
    }
    const recordId = this.recordIdFactory(intent);
    const createdAt = new Date(this.clock.now()).toISOString();
    this.repository.add({
      record_id: recordId,
      conversation_id: intent.conversationId ?? intent.shopId ?? "",
      class: intent.class,
      trust_level: effect.record_trust,
      created_at: createdAt,
      effect_status: "PENDING",
      attempts: 0,
    });
    this.eventBus.emit("feedback.recorded", { record_id: recordId, class: intent.class });

    const request: KnowledgeEffectRequest = {
      record_id: recordId,
      conversation_id: intent.conversationId ?? "",
      class: intent.class,
      trust_level: effect.knowledge_trust,
      question: (intent.question as string | undefined) ?? "",
      answer: intent.reply ?? "",
      product_id: "",
      entry: {},
      created_at: createdAt,
      retry: false,
    };
    return await this.applyEffect(request, 1);
  }

  /** Apply a knowledge effect with bounded retry; idempotent by record id. */
  async applyEffect(request: KnowledgeEffectRequest, attempt = 1): Promise<FeedbackEffectStatusView> {
    if (this.idempotency.isDuplicate(request.record_id) || this.idempotency.isEffectApplied(this.repository as never, request.record_id)) {
      return { record_id: request.record_id, effect_status: "APPLIED", attempts: attempt, applied_at: new Date(this.clock.now()).toISOString() };
    }
    let result;
    try {
      result = await this.knowledgeClient.apply(request);
    } catch (e) {
      result = { record_id: request.record_id, ok: false, knowledge_op: "none", index_refresh: "none", applied: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (result.ok) {
      this.idempotency.mark(request.record_id);
      this.repository.updateEffectStatus(request.record_id, "APPLIED", { attempts: attempt, lastError: null, appliedAt: new Date(this.clock.now()).toISOString() });
      this.eventBus.emit("feedback.applied", { record_id: request.record_id });
      return { record_id: request.record_id, effect_status: "APPLIED", attempts: attempt, applied_at: new Date(this.clock.now()).toISOString() };
    }
    const lastError = result.error ?? "unknown";
    if (this.retryPolicy.shouldRetry(attempt, lastError)) {
      this.repository.updateEffectStatus(request.record_id, "FAILED_RETRYABLE", { attempts: attempt, lastError });
      await new Promise((r) => setTimeout(r, this.retryPolicy.nextDelayMs(attempt)));
      return this.applyEffect({ ...request, retry: true }, attempt + 1);
    }
    this.repository.updateEffectStatus(request.record_id, "FAILED_FINAL", { attempts: attempt, lastError });
    throw new FeedbackError(FEEDBACK_ERROR_CODES.RETRY_EXHAUSTED, lastError);
  }

  /** Explicit durable retry for a previously persisted record. */
  async retry(recordId: string, request: KnowledgeEffectRequest): Promise<FeedbackEffectStatusView> {
    return this.applyEffect({ ...request, record_id: recordId, retry: true }, 1);
  }

  status(recordId: string): FeedbackEffectStatusView | null {
    const rec = this.repository.list(10000).find((r) => r.record_id === recordId);
    if (!rec) return null;
    return { record_id: rec.record_id, effect_status: rec.effect_status ?? "PENDING", attempts: rec.attempts ?? 0, last_error: rec.last_error, applied_at: rec.applied_at };
  }
}
