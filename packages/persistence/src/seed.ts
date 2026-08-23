// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): idempotent default provisioning (insert-if-missing, never overwrites user values).
import type { SqliteConnection } from "./db/sqlite-driver.js";
import { validateConfigGroup } from "./config-validate.js";
import { PersistenceError, ERROR_CODES } from "./db/errors.js";

export interface ConfigDefault {
  group: string;
  payload: Record<string, unknown>;
}

// Drift-corrected defaults (TASK-014): RAG values from spec/ai/rag-pipeline.md;
// collaboration breaker 2 / 60000ms and send_interval_ms 800 (PARTIAL provenance,
// comment-derived) from spec/architecture/multi-shop-orchestration.md + node-send-pipeline.md.
export function defaultConfigGroups(dataRoot: string): ConfigDefault[] {
  return [
    { group: "AIConfig", payload: { current_model: "", providers: [], max_tokens: "20个字以内", image_recognition: true, question_completion: true } },
    { group: "RAGConfig", payload: {
        embedding_dim: 1024, metric: "cosine", product_search_top_k: 15,
        product_quality_threshold: 0.6, product_fast_return_threshold: 0.9,
        completed_fast_return_sim: 0.9, completed_fast_return_len_diff: 3,
        rerank_high_similarity_skip: 0.85, rerank_skip_candidate_count: 3,
        similarity_weight: 0.4, rerank_weight: 0.6, raw_protection_threshold: 0.7,
        low_rerank_penalty: 0.1, composite_clamp: 1.0, reference_top_n: 10 } },
    { group: "ConversationPolicyConfig", payload: { countdown_seconds: 5, countdown_action: "reply", similarity_threshold: 1.0, welcome_message: true, send_interval_ms: 800 } },
    { group: "CollaborationConfig", payload: { mode: "human_review", countdown_seconds: 5, send_interval_ms: 800, send_precheck: true, single_thread_listener: true, breaker_threshold: 2, breaker_window_ms: 60000 } },
    { group: "HandoffConfig", payload: { master_switch: true, working_hours: "", rules_ref: "" } },
    { group: "LearningConfig", payload: { freq_threshold: 0.9, top_n: 100, min_chars: 5, qa_cap: 2000, device_cap: 2000 } },
    { group: "OptimizationConfig", payload: { cooldown_seconds: 3600, cooldown_purge_seconds: 86400, dirty_length_limit: 20000, min_qa_threshold: 20 } },
    { group: "StorageConfig", payload: { data_root: dataRoot } },
    { group: "FeatureFlags", payload: { enable_learning: true, enable_review: true, enable_optimization: true, enable_cloud_sync: false, enable_daily_optimization: true } },
  ];
}

/** Insert-if-missing provisioning. Re-running twice must not overwrite user values. */
export function seedDefaults(conn: SqliteConnection, dataRoot: string): number {
  let seeded = 0;
  for (const def of defaultConfigGroups(dataRoot)) {
    const existing = conn.get<{ group_name: string }>("SELECT group_name FROM config_groups WHERE group_name = ?", def.group);
    if (existing) continue;
    const check = validateConfigGroup(def.group, def.payload);
    if (!check.ok) {
      throw new PersistenceError(ERROR_CODES.VALIDATION, `default config ${def.group} failed schema validation: ${check.errors.join("; ")}`);
    }
    conn.run("INSERT OR IGNORE INTO config_groups (group_name, schema_version, payload_json, updated_at) VALUES (?, ?, ?, ?)",
             def.group, "1.0", JSON.stringify(def.payload), new Date().toISOString());
    seeded += 1;
  }
  return seeded;
}
