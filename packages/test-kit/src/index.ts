// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M0: INTERFACES/STUBS ONLY for the TASK-014 test seams. No business decisions.
// Simple utility containers/recorders are allowed; no FastWork business logic.

export interface FakeClock {
  now(): number;
  advance(ms: number): void;
  schedule(fn: () => void, delayMs: number): () => void;
}

export interface PlatformAdapterStub {
  readonly platform: string;
  capabilities(): string[];
  enqueueMessage(msg: Record<string, unknown>): void;
  probeConversation(conversationId: string): Record<string, unknown>;
}

export interface SendRecorder {
  recordSend(entry: { virtual_time_ms: number; shop: string; conversation: string; payload: unknown; result?: unknown }): void;
  sends(): { virtual_time_ms: number; shop: string; conversation: string; payload: unknown; result?: unknown }[];
}

export interface TransferRecorder {
  recordTransfer(entry: { virtual_time_ms: number; shop: string; conversation: string; target: string; reason?: string }): void;
  transfers(): { virtual_time_ms: number; shop: string; conversation: string; target: string; reason?: string }[];
}

export interface CapturedEventBus {
  emit(event: string, payload: Record<string, unknown>, correlationId?: string): void;
  captured(): { event: string; payload: Record<string, unknown>; sequence: number; virtual_time_ms: number; correlation_id?: string }[];
  expect(event: string, subset: Record<string, unknown>): boolean;
}

export interface MockGenerationProvider {
  configure(fingerprint: string, reply: { text?: string; tool_calls?: unknown[]; finish_reason?: string; usage?: unknown; error?: unknown }): void;
  generate(req: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface MockEmbeddingProvider {
  materialize(directive: { type: "basis" | "controlled_cosine"; dimension: number; index?: number; cosine_to?: string; score?: number }): number[];
}

export interface MockRerankProvider {
  configure(scores: Record<string, number>): void;
  rerank(query: string, candidates: unknown[]): Promise<{ index: number; score: number }[]>;
}

export interface InMemoryRepository<T> {
  all(): T[];
  find(id: string): T | undefined;
  upsert(item: T): void;
  snapshot(): T[];
}
export { VirtualClock } from "./fakes/fake-clock.js";
export { FakeAiEngineClient } from "./fakes/fake-ai-engine-client.js";
export { FakePlatformAdapter } from "./fakes/fake-platform-adapter.js";
export { CapturingEventBus } from "./fakes/captured-event-bus.js";
export { RecordingSendRecorder } from "./fakes/send-recorder.js";
export { FakeFeedbackSink } from "./fakes/fake-feedback-sink.js";
export { InMemoryConversationRepositoryPort } from "./fakes/in-memory-conversation-repository-port.js";
