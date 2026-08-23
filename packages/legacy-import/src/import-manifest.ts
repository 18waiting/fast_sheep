// M11 import manifest (clean-room). One manifest per selected source item:
// fingerprint, parser version, target aggregate/writer, counts, warnings,
// conflicts, secret fields. Never includes plaintext secrets.
import { readFileSync } from "node:fs";
import type { ImportItemManifest, SourceItemRef, TargetAggregate, TargetWriter } from "./types.js";
import { fingerprintFile } from "./source-fingerprint.js";
import { detectSecrets } from "./secret-policy.js";
import { parseShopsJson } from "./parsers/shops-parser.js";
import { parseSettingsJson } from "./parsers/settings-parser.js";
import { parseFastkeyConfig } from "./parsers/fastkey-config-parser.js";
import { parseProductsCsv } from "./parsers/products-parser.js";
import { parsePromptsJson } from "./parsers/prompts-parser.js";
import { parseSkillMd } from "./parsers/skills-parser.js";
import { parseTransferRulesCsv } from "./parsers/transfer-rules-parser.js";
import { parseForbiddenWordsJson } from "./parsers/forbidden-words-parser.js";
import { parseCsv } from "./parsers/csv-utils.js";

const PARSER_VERSION = "1.0.0";

const TARGET_BY_SOURCE: Record<string, { aggregate: TargetAggregate; writer: TargetWriter }> = {
  shops: { aggregate: "shops", writer: "main" },
  settings: { aggregate: "config_groups", writer: "main" },
  fastkey: { aggregate: "config_groups", writer: "main" },
  ai_settings: { aggregate: "config_groups", writer: "main" },
  products: { aggregate: "products", writer: "main" },
  knowledge: { aggregate: "knowledge_entries", writer: "worker" },
  candidates: { aggregate: "knowledge_candidates", writer: "worker" },
  prompts: { aggregate: "prompt_profiles", writer: "main" },
  skills: { aggregate: "skills", writer: "main" },
  skill_mounts: { aggregate: "product_skill_mounts", writer: "main" },
  transfer_rules: { aggregate: "transfer_rules", writer: "main" },
  forbidden_words: { aggregate: "forbidden_words", writer: "main" },
  messages: { aggregate: "conversations", writer: "main" },
};

export async function buildItemManifest(item: SourceItemRef, selectionId: string): Promise<ImportItemManifest> {
  const fingerprint = await fingerprintFile(item.path);
  const raw = readFileSync(item.path, "utf-8");
  const secrets = detectSecrets(parseRawForSecrets(item, raw));
  const { aggregate, writer } = TARGET_BY_SOURCE[item.source_type] ?? { aggregate: "config_groups" as TargetAggregate, writer: "main" as TargetWriter };
  const recordCount = countRecords(item);
  const warnings = collectWarnings(item);
  const target = TARGET_BY_SOURCE[item.source_type];
  return {
    item_id: item.item_id,
    selection_id: selectionId,
    display_name: item.display_name,
    source_type: item.source_type,
    source_fingerprint: fingerprint,
    parser_version: PARSER_VERSION,
    target_aggregate: target?.aggregate ?? "config_groups",
    target_writer: target?.writer ?? "main",
    record_count: recordCount,
    warnings,
    conflicts: [],
    secret_fields_detected: secrets.secret_fields_detected,
    apply_action: "insert",
    provenance: "user-selected legacy source",
  };
}

function parseRawForSecrets(item: SourceItemRef, raw: string): unknown {
  try {
    if (item.source_type === "knowledge" || item.source_type === "products" || item.source_type === "transfer_rules" || item.source_type === "messages") {
      return { csv: raw.slice(0, 100000) };
    }
    return JSON.parse(raw);
  } catch {
    return { text: raw.slice(0, 100000) };
  }
}

function countRecords(item: SourceItemRef): number {
  const raw = readFileSync(item.path, "utf-8");
  try {
    switch (item.source_type) {
      case "shops": return parseShopsJson(item).length;
      case "settings": return 1;
      case "fastkey": return parseFastkeyConfig(item).groups.length;
      case "ai_settings": return 1;
      case "products": return parseProductsCsv(item).length;
      case "prompts": return parsePromptsJson(item).prompts.length;
      case "skills": return 1;
      case "skill_mounts": return Object.keys(JSON.parse(raw)).length;
      case "transfer_rules": return parseTransferRulesCsv(item).rows.length;
      case "forbidden_words": return parseForbiddenWordsJson(item).length;
      case "messages": return parseCsv(raw).rows.length;
      case "knowledge":
      case "candidates": return parseCsv(raw).rows.length;
    }
  } catch {
    /* record count best-effort; parser errors surface at dry-run */
  }
  return 0;
}

function collectWarnings(item: SourceItemRef): Array<{ item_id: string; message: string }> {
  const out: Array<{ item_id: string; message: string }> = [];
  if (item.source_type === "skills") {
    out.push({ item_id: item.item_id, message: "skill imported disabled + untrusted; scripts never executed" });
  }
  if (item.source_type === "ai_settings") {
    out.push({ item_id: item.item_id, message: "provider secrets SKIP by default; credential_ref only on explicit consent" });
  }
  return out;
}
