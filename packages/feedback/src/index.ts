// @fastwork/feedback public surface (M9 clean-room).
export { FeedbackService, type FeedbackServiceOptions } from "./feedback-service.js";
export { effectForIntent, isNoSave, type IntentEffect } from "./feedback-effect-policy.js";
export { FeedbackIdempotency } from "./feedback-idempotency.js";
export { FeedbackRetryPolicy } from "./feedback-retry-policy.js";
export { FEEDBACK_ERROR_CODES, FeedbackError, type FeedbackErrorCode } from "./errors.js";
export type { FeedbackClass, FeedbackRecordInput, EffectStatus, KnowledgeEffectRequest, KnowledgeEffectResult, FeedbackEffectStatusView } from "./types.js";
export type { FeedbackRepositoryPort } from "./ports/feedback-repository-port.js";
export type { KnowledgeFeedbackClient } from "./ports/knowledge-feedback-client.js";
export type { Clock } from "./ports/clock.js";
export type { FeedbackEventBus } from "./ports/event-bus.js";
export { PersistenceFeedbackRepository } from "./adapters/persistence-feedback-repository.js";
export { WorkerKnowledgeFeedbackClient } from "./adapters/worker-knowledge-feedback-client.js";
export { OrchestratorFeedbackSink } from "./adapters/orchestrator-feedback-sink.js";
