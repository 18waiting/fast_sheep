// M11 Fastkey parser (clean-room). settings/Fastkey.json -> canonical config
// payloads (GF-STORE-003 mapping).
import type { SourceItemRef } from "../types.js";
import { readFileSync } from "node:fs";
import { detectSecrets } from "../secret-policy.js";

export interface FastkeyImportResult {
  groups: Array<{ group: string; payload: Record<string, unknown> }>;
  secret_fields_detected: string[];
}

export function parseFastkeyConfig(item: SourceItemRef): FastkeyImportResult {
  const raw = JSON.parse(readFileSync(item.path, "utf-8")) as Record<string, unknown>;
  const collaboration: Record<string, unknown> = {};
  const conversation: Record<string, unknown> = {};
  const rag: Record<string, unknown> = {};
  if (raw["倒计时时间"] !== undefined) { collaboration.countdown_seconds = Number(raw["倒计时时间"]); conversation.countdown_seconds = Number(raw["倒计时时间"]); }
  if (raw["AI全托管"] !== undefined) collaboration.mode = raw["AI全托管"] === true ? "full_auto" : "human_review";
  if (raw["单线程监听模式开关"] !== undefined) collaboration.single_thread_listener = Boolean(raw["单线程监听模式开关"]);
  if (raw["发送前检查新消息"] !== undefined) collaboration.send_precheck = Boolean(raw["发送前检查新消息"]);
  if (raw["问答相似度阈值"] !== undefined) conversation.similarity_threshold = Number(raw["问答相似度阈值"]);
  if (raw["商品级快速返回相似度阈值"] !== undefined) rag.product_fast_return_threshold = Number(raw["商品级快速返回相似度阈值"]);
  const secrets = detectSecrets(raw);
  return {
    groups: [
      { group: "CollaborationConfig", payload: collaboration },
      { group: "ConversationPolicyConfig", payload: conversation },
      { group: "RAGConfig", payload: rag },
    ],
    secret_fields_detected: secrets.secret_fields_detected,
  };
}
