// M11 settings parser (clean-room). 协同.json / 高阶设置.json -> config_groups
// payloads validated against the canonical JSON schemas by the writer.
import type { SourceItemRef } from "../types.js";
import { readFileSync } from "node:fs";
import { detectSecrets } from "../secret-policy.js";

export interface SettingsImportResult {
  group: string;
  payload: Record<string, unknown>;
  secret_fields_detected: string[];
  warnings: string[];
}

export function parseSettingsJson(item: SourceItemRef): SettingsImportResult {
  const raw = JSON.parse(readFileSync(item.path, "utf-8")) as Record<string, unknown>;
  const name = item.display_name;
  let group = "FeatureFlags";
  const payload: Record<string, unknown> = {};
  const warnings: string[] = [];
  if (name === "协同.json") {
    group = "CollaborationConfig";
    if (raw["倒计时秒数"] !== undefined) payload.countdown_seconds = Number(raw["倒计时秒数"]);
    if (raw["倒计时时间"] !== undefined) payload.countdown_seconds = Number(raw["倒计时时间"]);
    if (raw["AI全托管"] !== undefined) payload.mode = raw["AI全托管"] === true ? "full_auto" : "human_review";
    if (raw["发送前检查新消息"] !== undefined) payload.send_precheck = Boolean(raw["发送前检查新消息"]);
    if (raw["单线程监听模式开关"] !== undefined) payload.single_thread_listener = Boolean(raw["单线程监听模式开关"]);
  } else if (name === "高阶设置.json") {
    group = "FeatureFlags";
    if (raw["启用离线学习"] !== undefined) payload.enable_learning = Boolean(raw["启用离线学习"]);
    if (raw["启用AI每日自动优化"] !== undefined) payload.enable_daily_optimization = Boolean(raw["启用AI每日自动优化"]);
    if (raw["启用知识库商品隔离"] !== undefined) payload.enable_product_isolation = Boolean(raw["启用知识库商品隔离"]);
    if (raw["启用知识库秒回"] !== undefined) payload.enable_fast_return = Boolean(raw["启用知识库秒回"]);
    if (raw["启用开机自启动"] !== undefined) payload.enable_autostart = Boolean(raw["启用开机自启动"]);
  } else {
    warnings.push("unsupported settings file mapped to FeatureFlags with no recognized keys");
  }
  const secrets = detectSecrets(raw);
  return { group, payload, secret_fields_detected: secrets.secret_fields_detected, warnings };
}
