# Historical evidence package — public repository publication gate (2026-09-23)

> Owner-requested cleanup checkpoint. This report does not alter the archived 17 files, their hashes, product authority, project authorization, or SHEEP lifecycle. No live platform operation was performed.

## Confirmed findings

1. **CONFIRMED:** `origin` points to a GitHub repository that the unauthenticated GitHub repository API returned with `private=false` / `visibility=public` on 2026-09-23. Public-read status can change later; verify again before publication. No credentials were used or displayed by this check.
2. **CONFIRMED:** `HEAD` already contains the two root Markdown documents with author-machine absolute paths. The previous cleanup staged byte-identical renames of those documents; this round has not staged any new file. Git history retains previously published bytes even if future documents are redacted or removed.
3. **CONFIRMED:** Among the 17 historical evidence files, multiple previously untracked Markdown/JSON/script files contain author-machine absolute paths; the integrated proposal links to an original attachment outside the repository. The 15 untracked files were not staged because that would expand public disclosure of local-path metadata. A local path is not itself a credential, but public exposure and portability are Owner-controlled choices.
4. **CONFIRMED:** The static scan in `evidence-retention-audit-2026-09-23.md` found no common credential/PII shapes in the 17 files. That bounded negative result does not prove absence of sensitive material or establish permission to publish the external attachment or third-party source archive.
5. **CONFIRMED:** A relative-link navigation index was prepared at `reports/HISTORICAL_INBOUND_EVIDENCE.md`. It cannot cure absolute links embedded in immutable hash-referenced historical documents or make ignored `.tmp` snapshots portable.

## Decision required before staging a complete package

- **A — Publish historical originals as-is:** Owner explicitly accepts the additional disclosure of machine-local path metadata in the public repository, while keeping the external attachment and `.tmp` snapshots out of Git. Then stage only the 15 reviewed evidence files and the cleanup/navigation reports by an exact allowlist; verify index, hashes and staged diff before any commit. The original historical SHA receipts remain valid.
- **B — Publish a derived redacted package (privacy-first recommendation):** Keep the original bytes local and out of any new public commit; create sanitized derivatives with machine paths removed, clearly label them as derivatives, recompute cross-file hash receipts, and maintain a non-public original-to-derivative provenance record. The two already tracked originals still remain recoverable from old Git history; true erasure would require a separately authorized history rewrite and remote coordination. This is more work and not a silent edit of original evidence.

**PRODUCT_DECISION_REQUIRED:** Choose A or B (or explicitly keep this research local only). The user's approval to continue cleanup did not explicitly authorize publishing more author-machine path metadata to a public repository. No candidate evidence file or index was newly staged under this uncertainty.

## Validation and boundaries

- prior audit: 17/17 present, eight JSON parse, hash receipts match, heuristic sensitive-content scan disclosed with limits
- current staged set: only the two pre-existing 100% document renames (no new staging in this round)
- archived generators/runtime tests: NOT_RUN; no source, platform-session code, authorization or third-party reference tree changed
- next_stage_not_executed: true; Controller review: NOT_RUN; SHEEP-305 remains open

## Subsequent Owner decision and follow-up (2026-09-23)

**CONFIRMED:** Owner selected **B — derived redacted package**. This closes the A/B publication choice for this cleanup only, not any product/platform decision. Implementation and its bounded validation are recorded in [the B cleanup report](evidence-publication-b-2026-09-23.md); the [public navigation](HISTORICAL_INBOUND_EVIDENCE.md) now points to the derived package. The above checkpoint accurately describes the state *before* that decision and must not be read as the final staging status.
