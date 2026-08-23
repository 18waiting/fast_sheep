// M11 worker-import-client port (clean-room). Worker imports knowledge/candidates.
import type { KnowledgeImportRequest, KnowledgeImportResult } from "../types.js";

export interface WorkerImportClientPort {
  validateKnowledge(request: KnowledgeImportRequest): Promise<{ ok: boolean; errors: string[]; rows: number }>;
  applyKnowledge(request: KnowledgeImportRequest): Promise<KnowledgeImportResult>;
  verifyKnowledge(itemId: string): Promise<{ ok: boolean; counts: Record<string, number> }>;
}
