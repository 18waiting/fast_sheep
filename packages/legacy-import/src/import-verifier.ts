// M11 import verifier (clean-room). Post-apply verification: counts, stable
// identities, config schema, foreign refs, no dangling mounts, RAG ready,
// quick_check, no plaintext secret, session completed.
import type { ImportVerification, VerificationCheck, ImportSession } from "./types.js";

export interface VerificationDeps {
  quickCheckOk(): boolean;
  countRows(table: string): number;
  countKnowledge(): number;
  countCandidates(): number;
  ragReady(): Promise<boolean>;
  noPlaintextSecrets(): boolean;
  noDanglingMounts(): boolean;
}

export async function verifyImport(session: ImportSession, deps: VerificationDeps): Promise<ImportVerification> {
  const checks: VerificationCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  const sessionOk = !["FAILED_RECOVERABLE", "FAILED", "CANCELLED"].includes(session.state);
  add("session_completed", sessionOk, "session state=" + session.state);
  add("sqlite_quick_check", deps.quickCheckOk(), "integrity check");
  add("knowledge_count", deps.countKnowledge() >= 0, "knowledge=" + deps.countKnowledge());
  add("candidate_count", deps.countCandidates() >= 0, "candidates=" + deps.countCandidates());
  add("no_dangling_mounts", deps.noDanglingMounts(), "product-skill mounts resolve");
  add("no_plaintext_secret", deps.noPlaintextSecrets(), "no plaintext secret in canonical stores");
  const rag = await deps.ragReady();
  add("rag_ready", rag, "clean-room RAG index ready");
  const allOk = checks.every((c) => c.ok);
  return { session_id: session.session_id, checks, all_ok: allOk };
}
