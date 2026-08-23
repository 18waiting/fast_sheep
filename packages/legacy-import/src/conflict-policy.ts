// M11 conflict policy (clean-room). Explicit enum; default PRESERVE_EXISTING.
import type { ConflictPolicy } from "./types.js";

export const DEFAULT_CONFLICT_POLICY: ConflictPolicy = "PRESERVE_EXISTING";

export const CONFLICT_POLICIES: ConflictPolicy[] = [
  "PRESERVE_EXISTING",
  "INSERT_MISSING",
  "MERGE_SAFE_FIELDS",
  "REPLACE_SELECTED",
];

export function isConflictPolicy(value: unknown): value is ConflictPolicy {
  return typeof value === "string" && (CONFLICT_POLICIES as string[]).includes(value);
}

export function resolveConflict(existing: unknown, incoming: unknown, policy: ConflictPolicy): { action: "insert" | "skip" | "replace" | "merge"; reason?: string } {
  switch (policy) {
    case "PRESERVE_EXISTING":
      return existing === undefined || existing === null
        ? { action: "insert" }
        : { action: "skip", reason: "existing preserved" };
    case "INSERT_MISSING":
      return { action: "insert" };
    case "REPLACE_SELECTED":
      return { action: "replace" };
    case "MERGE_SAFE_FIELDS":
      return existing === undefined || existing === null
        ? { action: "insert" }
        : { action: "merge", reason: "merge safe fields" };
  }
}
