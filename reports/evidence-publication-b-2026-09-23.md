# Historical inbound evidence — Owner B cleanup (2026-09-23)

> Owner chose **B: only a redacted derivative package may enter a new public commit**. This is a bounded repository-maintenance result, not a SHEEP task completion, Controller PASS, real-platform authorization, or privacy guarantee. `next_stage_not_executed = true`.

## Result and scope

- Bounded maintenance result: **COMPLETE** for preparing and locally staging the derivative package; **no commit or push**. Broader platform-session retirement remains separate and gated.
- The historical 2026-09-20 records are not current product/architecture/authorization authority. [`PROJECT_STATE.json`](../project/PROJECT_STATE.json) still governs SHEEP-305; its Lane A/B offline PASS does not close the whole task. No real binding, policy activation, SHEEP-306, AI, send, or platform session action occurred.
- The original 17 files in three dated report directories are byte-for-byte unchanged and retained locally. Their individual original and derivative SHA-256 mapping is in ignored `.tmp/evidence-publication-2026-09-23/original-provenance.json`, not in this public report. A local `.git/info/exclude` entry protects those three original directories from ordinary `git add -A` (not from an explicit force-add). Do not force-add them.
- Two formerly staged 100%-identical original renames were unstaged with path-limited `git restore --staged`; the tracked root originals are removed from their root paths; Git may display them as similarity-based renames to the redacted derivatives, but no original blob is added. Earlier Git history retains those bytes and paths. This cleanup does **not** erase history or guarantee remote removal; such a rewrite would need separate approval and coordination.

## Published derivative shape

- [`reports/public-inbound-evidence-2026-09-23/README.md`](public-inbound-evidence-2026-09-23/README.md) explains the transformation and limitations. [`manifest.json`](public-inbound-evidence-2026-09-23/manifest.json) contains 17 derived component paths, byte counts and SHA-256 values; the two originals' root duplicates are represented by derivatives inside their evidence groups.
- Repository absolute machine paths became relative links or repository-relative references. Links to derived components point to derivatives. Ignored snapshots use `LOCAL_ONLY`, outside attachment uses `PRIVATE_ATTACHMENT_NOT_INCLUDED`, the attachment fingerprint is not published, and the local tool runtime uses a non-portable marker. No attachment or third-party source snapshot was copied.
- All 17 component byte streams changed with visible derivation marking. The three document receipts (`report_sha256` ×2 and `document_sha256` ×1) now match the derived Markdown bytes; derived proposal character/line counts were updated. Other historical source/snapshot hashes remain dated receipts, **not** current source or derivative verification.
- The two archival script copies throw before doing their former work. They are static evidence, not executable validation tools. The generators were **not run**. The [navigation index](HISTORICAL_INBOUND_EVIDENCE.md) points only to derivatives, and the prior [publication gate](evidence-package-publication-gate-2026-09-23.md) notes the Owner's subsequent B decision.

## Evidence classification and limits

- **CONFIRMED:** 17/17 originals match the local fixed SHA-256 inventory; 17/17 derivatives differ, match their manifest entries and are present; eight derivative JSON files parse; 3/3 document receipt hashes match; 64 checked local Markdown links resolve (including navigation/notice/gate). Static scan of all derived files found no author `/Users` path, username, Downloads path, original attachment hash, or specified common secret-key patterns. This is a bounded static scan, not exhaustive PII/privacy proof.
- **CONFIRMED:** derivative Python parses and begins with an unconditional raise; derivative JS parses and begins with a throw; no archived generator was executed. Current project-state consistency tests pass **20/20**, validator reports `PROJECT_STATE_CONSISTENCY=PASS`; staged/unstaged `git diff --check` pass.
- **INFERRED:** These checks materially reduce accidental disclosure of the known local metadata. They do not prove that every historical statement is correct, that every sensitive shape has been found, or that third-party references are licensed for commercial use.
- **BLOCKED:** Original external attachment cannot be verified by a public checkout. Ignored `.tmp` third-party snapshot and two historical source hashes that now differ from current code are not portable or current-runtime proof. Read-only external reference trees were not accessed; independent global integrity was not audited.
- **DEFERRED:** Git-history rewriting; full runtime integration/smoke and platform tests (no runtime implementation changed); real controlled-session proof, binding provenance and field-level SHIPPING_TIME semantics. Controller review: **NOT_RUN**.

## Staging boundary

Only tracked root-path removal (possibly displayed by Git as redacted renames), this cleanup/navigation report set, and the 19-file derivative directory (17 components + README + manifest) are staged for review. Existing `README.md`, `project/PROJECT_STATE.json`, state validator/test edits, and `ecommerce-ai-architecture.zip` removal remain **unstaged** as pre-existing cleanup work. A `--no-renames` patch can show old deleted lines; no original content is introduced as a new Git blob. Check staged added blobs and `git diff --cached --name-status` again before any commit; do not `git add -A`, force-add originals, or automatically commit/push.
