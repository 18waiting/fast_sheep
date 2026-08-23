// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

export type {
  AiEngineClient,
  AiEngineResult,
  GenerateReplyInput,
  GenerateReplyResult,
  TransferDecision,
} from "./ports/ai-engine-client.js";
export type {
  CurrentConversationState,
  PlatformAdapter,
  SendAttempt,
} from "./ports/platform-adapter.js";
export type { Clock } from "./ports/clock.js";
export type { EventBus, EventHandler, Unsubscribe } from "./ports/event-bus.js";
export type { FeedbackClass, FeedbackIntent, FeedbackSink } from "./ports/feedback-sink.js";
export type {
  ConversationRepositoryPort,
  ConversationTurn,
  ConversationTurnRole,
} from "./ports/conversation-repository-port.js";

export { GenerationToken } from "./state/generation-token.js";
export type { SuggestionState } from "./state/suggestion-state.js";
export {
  createConversationRuntimeState,
  type BreakerRuntimeState,
  type ConversationRuntimeState,
  type CountdownRuntimeState,
  type SendRequest,
} from "./state/conversation-runtime-state.js";
export type {
  ConversationSnapshot,
  DecisionRecord,
  OrchestratorSnapshot,
} from "./state/orchestrator-state.js";

export { ReviewModePolicy, type ReviewMode } from "./policies/review-mode-policy.js";
export { CountdownPolicy, type CountdownDecision } from "./policies/countdown-policy.js";
export {
  TakeoverBreakerPolicy,
  type TakeoverBreakerDecision,
} from "./policies/takeover-breaker-policy.js";
export { PreSendRevalidationPolicy } from "./policies/pre-send-revalidation-policy.js";
export { SegmentedSendPolicy, type SegmentedSendPart } from "./policies/segmented-send-policy.js";
export { FeedbackIntentPolicy, type FeedbackIntentClass } from "./policies/feedback-intent-policy.js";

export { SuggestionManager } from "./core/suggestion-manager.js";
export { CountdownController } from "./core/countdown-controller.js";
export { SendSerializer, type SendSerializerStatus } from "./core/send-serializer.js";
export { SegmentedSender, type ScheduleFn, type SegmentedSenderOptions, type SendTextFn } from "./core/segmented-sender.js";
export { ManualTakeoverController } from "./core/manual-takeover-controller.js";
export { PreSendController, type PreSendRevalidationResult } from "./core/pre-send-controller.js";
export {
  ConversationOrchestrator,
  type BuyerMessage,
  type OrchestratorOptions,
  type OrchestratorPolicies,
} from "./core/conversation-orchestrator.js";
export {
  ShopOrchestratorRegistry,
  type ShopOrchestratorFactory,
} from "./core/shop-orchestrator-registry.js";

export { WorkerAiEngineClient, type WorkerGenerateReplyResponse, type WorkerLike } from "./adapters/worker-ai-engine-client.js";
export { PersistenceConversationRepository, type PersistenceAppendTurn, type PersistenceLike } from "./adapters/persistence-conversation-repository.js";
export { ForbiddenFilter } from "./pre-send/forbidden-filter.js";
export { MessageCleaner } from "./pre-send/message-cleaner.js";