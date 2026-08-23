// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ContractEntry {
  id: string;
  version: string;
  schema: string;
  direction: string;
  owner: string;
  status: "IMPLEMENTED" | "DESIGN_ONLY";
  source: string;
  behavior_ids: string[];
}

export interface ContractRegistry {
  schema_version: string;
  schema_draft: string;
  contracts: ContractEntry[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
export const CONTRACTS_ROOT = join(HERE, "..");
export const SCHEMAS_ROOT = join(CONTRACTS_ROOT, "schemas");

export function loadRegistry(): ContractRegistry {
  const p = join(CONTRACTS_ROOT, "contract-registry.json");
  if (!existsSync(p)) throw new Error("contract-registry.json missing");
  return JSON.parse(readFileSync(p, "utf-8")) as ContractRegistry;
}

export function schemaPath(id: string): string {
  const reg = loadRegistry();
  const e = reg.contracts.find((c) => c.id === id);
  if (!e) throw new Error(`schema ${id} not registered`);
  const p = join(CONTRACTS_ROOT, e.schema);
  if (!existsSync(p)) throw new Error(`schema file missing for ${id}: ${p}`);
  return p;
}

export function loadSchema(id: string): unknown {
  return JSON.parse(readFileSync(schemaPath(id), "utf-8"));
}
