// GENERATED TYPE MIRRORS — keep in sync with rebuild/packages/contracts/schemas/rag/*.schema.json.
// Clean-room implementation. JSON Schema (Draft 2020-12) is the single source of truth.

export interface RetrievalRequest {
  query: string;
  product_id?: string;
  order_state?: "未下单" | "已下单";
  knowledge_isolation?: boolean;
  top_k?: number;
}

export interface RebuildIndexRequest {
  mode: "full" | "incremental" | "precise_delete";
  entry_ids?: string[];
  product_id?: string;
}

export interface RebuildIndexResult {
  mode: string;
  ok: boolean;
  entry_count?: number;
  product_index_count?: number;
  global_count?: number;
  built_at?: string;
}

export interface IndexStatusResult {
  ready: boolean;
  dimension: number;
  metric: string;
  global_count?: number;
  product_index_count?: number;
  common_count?: number;
  last_build_at?: string;
  index_schema_version?: number;
  derived_root?: string;
}
