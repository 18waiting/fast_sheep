import { isAbsolute, relative, resolve } from "node:path";

export const PROOF_SUBDIRECTORY = "sheep-301-local-electron-websocket-boundary-proof";

export function proofRootForRepo(repoRoot) {
  return resolve(repoRoot, ".tmp", PROOF_SUBDIRECTORY);
}

export function validateProofRoot(repoRoot, candidate) {
  const resolvedRepo = resolve(repoRoot);
  const resolvedCandidate = resolve(candidate);
  const expected = proofRootForRepo(resolvedRepo);
  const rel = relative(resolvedRepo, resolvedCandidate);
  const insideRepo = rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  const exact = resolvedCandidate === expected;
  let reason = "OK";
  if (!insideRepo) reason = "PATH_OUTSIDE_REPO";
  else if (!exact) reason = "NOT_EXACT_PROOF_ROOT";
  return { ok: insideRepo && exact, reason, resolvedRepo, resolvedCandidate, expected, relativeToRepo: rel };
}

export function assertProofRoot(repoRoot, candidate) {
  const result = validateProofRoot(repoRoot, candidate);
  if (!result.ok) throw new Error(`invalid proof root (${result.reason}): ${result.resolvedCandidate}`);
  return result;
}
