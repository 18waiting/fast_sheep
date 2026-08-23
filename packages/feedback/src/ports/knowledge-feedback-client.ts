// M9 knowledge-feedback client port (clean-room). Worker RPC feedback.apply.
import type { KnowledgeEffectRequest, KnowledgeEffectResult } from "../types.js";

export interface KnowledgeFeedbackClient {
  apply(request: KnowledgeEffectRequest): Promise<KnowledgeEffectResult>;
}
