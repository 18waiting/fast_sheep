// M11 path safety (clean-room). Blocks traversal, root escape, symlink/junction
// escape, device paths and unsafe descendants.
import { resolve, sep } from "node:path";
import { statSync, realpathSync } from "node:fs";
import { LegacyImportError, IMPORT_ERROR_CODES } from "./errors.js";

export interface PathSafetyLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxCsvRows: number;
  maxJsonDepth: number;
  maxSkillAssets: number;
  maxSkillAssetBytes: number;
}

export const DEFAULT_SAFETY_LIMITS: PathSafetyLimits = {
  maxFiles: 5000,
  maxFileBytes: 50 * 1024 * 1024,
  maxCsvRows: 200000,
  maxJsonDepth: 64,
  maxSkillAssets: 200,
  maxSkillAssetBytes: 5 * 1024 * 1024,
};

export function isDevicePath(p: string): boolean {
  return /^[a-zA-Z]:[\/]/.test(p) || /^\\/.test(p) || /^[\/]{2}/.test(p);
}

/** Verify that `candidate` resolves to a path strictly inside `root`. */
export function assertInsideRoot(root: string, candidate: string): string {
  const rootResolved = resolve(root);
  const candidateResolved = resolve(candidate);
  if (candidateResolved === rootResolved) return rootResolved;
  if (!candidateResolved.startsWith(rootResolved + sep)) {
    throw new LegacyImportError(IMPORT_ERROR_CODES.PATH_UNSAFE, "path escapes selection root: " + candidate);
  }
  const rel = candidateResolved.slice(rootResolved.length).replace(/^[\/]+/, "");
  if (rel.split(sep).includes("..")) {
    throw new LegacyImportError(IMPORT_ERROR_CODES.PATH_UNSAFE, "traversal token in path: " + candidate);
  }
  return candidateResolved;
}

/** Reject `..` traversal tokens inside a relative path. */
export function rejectTraversal(relPath: string): string {
  const parts = relPath.split(/[\/]+/).filter((p) => p.length > 0 && p !== ".");
  if (parts.includes("..")) {
    throw new LegacyImportError(IMPORT_ERROR_CODES.PATH_UNSAFE, "traversal token in path: " + relPath);
  }
  return parts.join(sep);
}

/** Reject symlink/junction escapes: the real path must stay under the real root. */
export function assertNoSymlinkEscape(root: string, candidate: string): void {
  try {
    const realRoot = realpathSync(root);
    const realCandidate = realpathSync(candidate);
    if (realCandidate !== realRoot && !realCandidate.startsWith(realRoot + sep)) {
      throw new LegacyImportError(IMPORT_ERROR_CODES.PATH_UNSAFE, "symlink escape detected: " + candidate);
    }
  } catch (e) {
    if (e instanceof LegacyImportError) throw e;
    if (!statSync(root, { throwIfNoEntry: false })) {
      throw new LegacyImportError(IMPORT_ERROR_CODES.INVALID_SOURCE, "selection root missing: " + root);
    }
  }
}
