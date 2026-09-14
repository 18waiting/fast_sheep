// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): validate config_groups payloads against the M0 JSON Schemas
// (packages/contracts/schemas/config/*.schema.json) before commit.
import { Ajv2020 } from "ajv/dist/2020.js";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CONFIG_SCHEMAS_DIR = join(HERE, "..", "..", "contracts", "schemas", "config");
const COMMON_SCHEMAS_DIR = join(HERE, "..", "..", "contracts", "schemas", "common");

export const CONFIG_GROUP_SCHEMA_IDS: Record<string, string> = {
  AIConfig: "fastwork:config:ai-config",
  RAGConfig: "fastwork:config:rag-config",
  ConversationPolicyConfig: "fastwork:config:conversation-policy-config",
  CollaborationConfig: "fastwork:config:collaboration-config",
  HandoffConfig: "fastwork:config:handoff-config",
  PlatformConfig: "fastwork:config:platform-config",
  LearningConfig: "fastwork:config:learning-config",
  OptimizationConfig: "fastwork:config:optimization-config",
  StorageConfig: "fastwork:config:storage-config",
  FeatureFlags: "fastwork:config:feature-flags",
};

let _ajv: Ajv2020 | null = null;

function ajv(): Ajv2020 {
  if (_ajv) return _ajv;
  const a = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ } });
  for (const f of readdirSync(COMMON_SCHEMAS_DIR).filter((x) => x.endsWith(".schema.json")).sort()) {
    a.addSchema(JSON.parse(readFileSync(join(COMMON_SCHEMAS_DIR, f), "utf-8")));
  }
  for (const f of readdirSync(CONFIG_SCHEMAS_DIR).filter((x) => x.endsWith(".schema.json")).sort()) {
    a.addSchema(JSON.parse(readFileSync(join(CONFIG_SCHEMAS_DIR, f), "utf-8")));
  }
  _ajv = a;
  return a;
}

export function validateConfigGroup(groupName: string, payload: unknown): { ok: boolean; errors: string[] } {
  const id = CONFIG_GROUP_SCHEMA_IDS[groupName];
  if (!id) return { ok: false, errors: [`unknown config group ${groupName}`] };
  const v = ajv().getSchema(id);
  if (!v) return { ok: false, errors: [`schema not compiled ${id}`] };
  const ok = v(payload) as boolean;
  return { ok, errors: ok ? [] : (v.errors ?? []).map((e) => `${e.instancePath} ${e.message}`) };
}
