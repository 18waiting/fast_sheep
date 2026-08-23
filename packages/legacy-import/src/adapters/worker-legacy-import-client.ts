// M11 worker legacy-import client adapter (clean-room). M2 RPC:
// legacy_import.validate_knowledge / apply_knowledge / verify_knowledge.
import type { AIWorkerClient } from "@fastwork/worker-rpc";
import type { WorkerImportClientPort } from "../ports/worker-import-client.js";
import type { KnowledgeImportRequest, KnowledgeImportResult } from "../types.js";

export class WorkerLegacyImportClient implements WorkerImportClientPort {
  constructor(private readonly worker: AIWorkerClient) {}

  async validateKnowledge(request: KnowledgeImportRequest): Promise<{ ok: boolean; errors: string[]; rows: number }> {
    const res = await this.worker.request<Record<string, unknown>>("legacy_import.validate_knowledge", {
      selection_id: request.selection_id, item_id: request.item_id, rows: request.rows,
    });
    return { ok: res.ok === true, errors: (res.errors as string[] | undefined) ?? [], rows: Number(res.rows ?? 0) };
  }

  async applyKnowledge(request: KnowledgeImportRequest): Promise<KnowledgeImportResult> {
    const res = await this.worker.request<Record<string, unknown>>("legacy_import.apply_knowledge", {
      selection_id: request.selection_id, item_id: request.item_id, rows: request.rows,
    });
    return {
      inserted: Number(res.inserted ?? 0),
      skipped_duplicates: Number(res.skipped_duplicates ?? 0),
      candidates: Number(res.candidates ?? 0),
      trust_map: (res.trust_map as Record<string, string>) ?? {},
    };
  }

  async verifyKnowledge(itemId: string): Promise<{ ok: boolean; counts: Record<string, number> }> {
    const res = await this.worker.request<Record<string, unknown>>("legacy_import.verify_knowledge", { item_id: itemId });
    return { ok: res.ok === true, counts: (res.counts as Record<string, number>) ?? {} };
  }
}
