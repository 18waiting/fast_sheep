// M9 worker knowledge-feedback client adapter (clean-room). M2 RPC feedback.apply.
import type { AIWorkerClient } from "@fastwork/worker-rpc";
import type { KnowledgeFeedbackClient } from "../ports/knowledge-feedback-client.js";
import type { KnowledgeEffectRequest, KnowledgeEffectResult } from "../types.js";

export class WorkerKnowledgeFeedbackClient implements KnowledgeFeedbackClient {
  constructor(private readonly worker: AIWorkerClient) {}

  async apply(request: KnowledgeEffectRequest): Promise<KnowledgeEffectResult> {
    const res = await this.worker.request<Record<string, unknown>>("feedback.apply", {
      record_id: request.record_id,
      conversation_id: request.conversation_id,
      class: request.class,
      trust_level: request.trust_level,
      question: request.question,
      answer: request.answer,
      product_id: request.product_id,
      entry: request.entry,
      created_at: request.created_at,
      retry: request.retry,
    });
    return {
      record_id: String(res.record_id ?? request.record_id),
      ok: res.ok === true,
      knowledge_op: (res.knowledge_op as KnowledgeEffectResult["knowledge_op"]) ?? "none",
      entry_id: res.entry_id as string | undefined,
      index_refresh: (res.index_refresh as KnowledgeEffectResult["index_refresh"]) ?? "none",
      applied: res.applied === true,
      error: res.error as string | undefined,
    };
  }
}
