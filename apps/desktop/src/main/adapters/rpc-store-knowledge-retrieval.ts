/**
 * RPC StoreKnowledge Retrieval Adapter (SHEEP-306, P1-6b).
 *
 * Purpose: Implement StoreKnowledgeRetrievalPort by bridging to Worker RPC.
 * Main calls Worker's store_knowledge.query / store_knowledge.list methods.
 *
 * Governance basis:
 * - SHEEP-305: Worker-side RPC methods store_knowledge.query / store_knowledge.list.
 * - DEC-008: Store Knowledge is layer 3 (store-scoped merchant knowledge).
 * - SHEEP-306: ContextEnvelope.retrieved_knowledge needs Store Knowledge data.
 *
 * Key invariants:
 * - Adapter bridges Main → Worker RPC (no direct DB access).
 * - Maps Worker RPC response to StoreKnowledgeEntry (Port types).
 * - Handles RPC errors gracefully (returns ok: false with error message).
 * - Does NOT modify Worker-side code.
 * - Does NOT implement vector retrieval (Phase 9).
 *
 * Owner SHEEP-306 decisions:
 * D1: Adapter uses RPC bridge (not direct DB read) for consistency with architecture.
 * D2: Adapter maps Worker response to Port types (snake_case, Layer 2 knowledge_type).
 * D3: Adapter does NOT compute relevance_score (deferred to Builder or Phase 9 RAG).
 */

import type { AIWorkerClient } from "@fastwork/worker-rpc";
import type {
  StoreKnowledgeRetrievalPort,
  StoreKnowledgeQueryParams,
  StoreKnowledgeQueryResult,
  StoreKnowledgeEntry,
} from "../ports/store-knowledge-retrieval-port.js";

/**
 * Worker RPC response shape for store_knowledge.query / store_knowledge.list.
 * This matches the Python Worker's response format.
 */
interface WorkerStoreKnowledgeResponse {
  ok: boolean;
  entries: Array<{
    id: string;
    merchant_id: string;
    store_id: string;
    knowledge_type: string;
    title: string;
    content: string;
    tags: string[];
    source: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  count: number;
  error?: string;
}

/**
 * RPC-based implementation of StoreKnowledgeRetrievalPort.
 *
 * Bridges Main → Worker RPC for Store Knowledge retrieval.
 * Worker-side implementation: services/ai-worker/src/fastwork_ai_worker/rpc/methods/store_knowledge.py
 *
 * Usage:
 * ```typescript
 * const workerClient: AIWorkerClient = ...; // injected
 * const port = new RpcStoreKnowledgeRetrievalAdapter(workerClient);
 * const result = await port.query({
 *   merchant_id: "m1",
 *   store_id: "s1",
 *   keywords: ["shipping", "delivery"],
 *   knowledge_type: "SHIPPING_TIME",
 *   status: "ACTIVE",
 *   limit: 20,
 * });
 * if (result.ok) {
 *   console.log(`Found ${result.count} entries`);
 * }
 * ```
 */
export class RpcStoreKnowledgeRetrievalAdapter implements StoreKnowledgeRetrievalPort {
  constructor(private readonly workerClient: AIWorkerClient) {}

  /**
   * Query Store Knowledge entries via Worker RPC.
   *
   * Calls Worker's store_knowledge.query method with keyword matching.
   * Maps Worker response to StoreKnowledgeEntry (Port types).
   *
   * @param params - Query parameters (merchant_id, store_id required)
   * @returns Query result with matching entries
   */
  async query(params: StoreKnowledgeQueryParams): Promise<StoreKnowledgeQueryResult> {
    try {
      // Build RPC payload (Worker expects snake_case)
      const payload: Record<string, unknown> = {
        merchant_id: params.merchant_id,
        store_id: params.store_id,
      };

      if (params.keywords && params.keywords.length > 0) {
        payload.keywords = params.keywords;
      }
      if (params.knowledge_type) {
        payload.knowledge_type = params.knowledge_type;
      }
      if (params.status) {
        payload.status = params.status;
      }
      if (params.limit !== undefined) {
        payload.limit = params.limit;
      }

      // Call Worker RPC
      const response = await this.workerClient.request<WorkerStoreKnowledgeResponse>(
        "store_knowledge.query",
        payload,
      );

      // Map Worker response to Port types
      return this.mapResponse(response);
    } catch (error) {
      // Handle RPC errors gracefully
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        entries: [],
        count: 0,
        error: `StoreKnowledge RPC query failed: ${errorMessage}`,
      };
    }
  }

  /**
   * List Store Knowledge entries via Worker RPC (no keyword matching).
   *
   * Calls Worker's store_knowledge.list method.
   * Maps Worker response to StoreKnowledgeEntry (Port types).
   *
   * @param params - Query parameters (keywords ignored if provided)
   * @returns Query result with matching entries
   */
  async list(params: Omit<StoreKnowledgeQueryParams, "keywords">): Promise<StoreKnowledgeQueryResult> {
    try {
      // Build RPC payload (Worker expects snake_case)
      const payload: Record<string, unknown> = {
        merchant_id: params.merchant_id,
        store_id: params.store_id,
      };

      if (params.knowledge_type) {
        payload.knowledge_type = params.knowledge_type;
      }
      if (params.status) {
        payload.status = params.status;
      }
      if (params.limit !== undefined) {
        payload.limit = params.limit;
      }

      // Call Worker RPC
      const response = await this.workerClient.request<WorkerStoreKnowledgeResponse>(
        "store_knowledge.list",
        payload,
      );

      // Map Worker response to Port types
      return this.mapResponse(response);
    } catch (error) {
      // Handle RPC errors gracefully
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        entries: [],
        count: 0,
        error: `StoreKnowledge RPC list failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Map Worker RPC response to StoreKnowledgeQueryResult.
   *
   * Worker returns entries with snake_case fields matching the DB schema.
   * Port types also use snake_case, so mapping is mostly identity.
   *
   * @param response - Worker RPC response
   * @returns Mapped StoreKnowledgeQueryResult
   */
  private mapResponse(response: WorkerStoreKnowledgeResponse): StoreKnowledgeQueryResult {
    if (!response.ok) {
      return {
        ok: false,
        entries: [],
        count: 0,
        error: response.error || "Worker returned ok: false",
      };
    }

    // Map Worker entries to StoreKnowledgeEntry (Port type)
    const entries: StoreKnowledgeEntry[] = response.entries.map((entry) => ({
      id: entry.id,
      merchant_id: entry.merchant_id,
      store_id: entry.store_id,
      knowledge_type: entry.knowledge_type as StoreKnowledgeEntry["knowledge_type"],
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      source: entry.source as StoreKnowledgeEntry["source"],
      status: entry.status as StoreKnowledgeEntry["status"],
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    }));

    return {
      ok: true,
      entries,
      count: response.count,
    };
  }
}

/**
 * Factory function for creating an RpcStoreKnowledgeRetrievalAdapter.
 *
 * @param workerClient - The AIWorkerClient instance (injected dependency)
 * @returns A new RpcStoreKnowledgeRetrievalAdapter instance
 */
export function createRpcStoreKnowledgeRetrievalAdapter(
  workerClient: AIWorkerClient,
): StoreKnowledgeRetrievalPort {
  return new RpcStoreKnowledgeRetrievalAdapter(workerClient);
}
