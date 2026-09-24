# Historical inbound evidence retention audit — 2026-09-23

> Owner-requested maintenance audit only; not a SHEEP task, product/architecture authority, authorization change, or instruction to execute any historical research script. Scope: the 17 existing files in the three `reports/*-2026-09-20/` trees below. No file in those trees was edited, deleted, or newly staged in this audit. `project/PROJECT_STATE.json` remains the current execution ledger.

## Result and decision vocabulary

- bounded audit result: **COMPLETE** (inventory and recommendations); evidence-package assembly: **NOT_RUN**
- `KEEP_TRACKED`: already staged as a byte-identical rename in the previous cleanup; retain as dated evidence, not current authority
- `TRACK_CANDIDATE`: preserve in a coherent historical evidence package only after the path/privacy and retention decision below; **not staged now**
- `CONDITIONAL_ARTIFACT`: historically cited generator/output; retain until the Owner selects a full or slim package and references are adjusted; do not run it in place
- `DELETE_NOW`: **none**; no file was proven redundant while its report references remain
- next_stage_not_executed: true

## Per-file inventory and disposition

All paths below are relative to the repository root. `T` = tracked in the index from the previous 100% rename; `U` = currently untracked. Sizes are byte counts. These roles are historical, not a claim of live validation.

| File | Git / bytes | Role and provenance | Recommendation / specific caveat |
|---|---:|---|---|
| `reports/pdd-inbound-analysis-2026-09-20/analysis.md` | U / 16,278 | Sep 20 inbound-gap diagnosis, counterexample and authority limits | `TRACK_CANDIDATE`; contains then-current SHEEP-301 status and local absolute paths; label as historical, not current status. |
| `reports/pdd-inbound-analysis-2026-09-20/clarencejh-reference-review.json` | U / 825 | Dated public-source review receipt; hash points to companion Markdown | `TRACK_CANDIDATE` together with the Markdown; report SHA matches. |
| `reports/pdd-inbound-analysis-2026-09-20/clarencejh-reference-review.md` | U / 5,714 | Pinned third-party source analysis, not a verified platform contract | `TRACK_CANDIDATE`; no third-party source code is imported by this document. |
| `reports/pdd-inbound-analysis-2026-09-20/offline-tests.tap` | U / 4,638 | Historical 23-test TAP output cited by `report.json` | `CONDITIONAL_ARTIFACT`; keep with full evidence package or revise the report's evidence pointer before a slim package. Historical PASS is not a current-code PASS. |
| `reports/pdd-inbound-analysis-2026-09-20/offline-validation.json` | U / 1,326 | Historical test metadata and six source hashes | `TRACK_CANDIDATE`; two of six source hashes now differ from the current tree. Do not present it as current verification. |
| `reports/pdd-inbound-analysis-2026-09-20/online-research.md` | U / 3,791 | Sep 20 public research and candidate routes | `TRACK_CANDIDATE`; dated research, not first-party PDD approval or current product direction. |
| `reports/pdd-inbound-analysis-2026-09-20/recommended-solution.json` | U / 641 | Receipt for the already tracked recommendation Markdown | `TRACK_CANDIDATE` with the Markdown; report path and SHA match. |
| `reports/pdd-inbound-analysis-2026-09-20/recommended-solution.md` | T / 12,697 | Owner-requested synthesis, previously tracked at repository root | `KEEP_TRACKED` as historical guidance; SHA unchanged by rename; not an execution authorization. |
| `reports/pdd-inbound-analysis-2026-09-20/report.json` | U / 7,724 | Diagnostic task ledger; explicitly cites TAP and harness | `TRACK_CANDIDATE`; points to an original attachment in Downloads outside the repository and an ignored `.tmp` output root. Do not copy the attachment without privacy/authorization review. |
| `reports/pdd-inbound-analysis-2026-09-20/verify-offline.mjs` | U / 7,041 | Diagnostic harness that transforms source/test copies and writes `.tmp` plus TAP/JSON outputs | `CONDITIONAL_ARTIFACT`; do not rerun in place because it overwrites historical outputs and now reads changed source. Keep if full reproducibility is selected. |
| `reports/pdd-inbound-engineering-plan-2026-09-20/engineering-plan.md` | T / 56,360 | Sep 20 proposed plan, previously tracked at repository root | `KEEP_TRACKED` as dated proposal only; it says it is not the reviewed Roadmap. Its appendix links to seven untracked report targets, ignored `.tmp` snapshots and an external Downloads attachment. |
| `reports/pdd-inbound-engineering-plan-2026-09-20/validation.json` | U / 5,689 | Document receipt, checks and historical temp artifact paths | `TRACK_CANDIDATE`; document path and SHA match; temp scripts remain ignored, so receipt is not a portable replay package. |
| `reports/zhinianboke-pdd-review-2026-09-20/analysis.md` | U / 22,126 | Pinned third-party static review and licensing caveat | `TRACK_CANDIDATE` as research; 32 links point to ignored local source snapshots; not a live platform or license approval. |
| `reports/zhinianboke-pdd-review-2026-09-20/build_report.py` | U / 23,877 | Historical report-generation recipe, cited as a report artifact | `CONDITIONAL_ARTIFACT`; hard-codes this machine's root, overwrites report files, and asserts a clean Git diff. Do not run in the current worktree. |
| `reports/zhinianboke-pdd-review-2026-09-20/report.json` | U / 6,953 | Third-party study receipt; cites all five artifacts | `TRACK_CANDIDATE`; its SHEEP-301 authorization snapshot is historical, not today's state. |
| `reports/zhinianboke-pdd-review-2026-09-20/source-manifest.json` | U / 39,242 | SHA-256 inventory for 362 files in a pinned public-source archive | `TRACK_CANDIDATE` with report/source index; the archive itself is ignored `.tmp` material, not a proposed repository import. |
| `reports/zhinianboke-pdd-review-2026-09-20/sources.json` | U / 15,083 | 32 line-level source URLs and SHA-256 records | `TRACK_CANDIDATE`; all 32 `path` values are machine-specific ignored `.tmp` paths. Fixed remote URLs and commit preserve a retrieval route, subject to availability. |

## Verification and limits

- **CONFIRMED:** 17/17 files present: 2 tracked/staged renames, 15 untracked. All eight JSON files parse. The three report/document SHA links (`clarencejh`, `recommended-solution`, `engineering-plan`) match their current targets.
- **CONFIRMED:** Historical TAP records 23 passed and zero failed; no test was rerun here. Four of six hashes in `offline-validation.json` match current files, while inbound normalizer source and test differ. This does not invalidate the dated run, but rerunning the harness today would not reproduce the same input snapshot.
- **CONFIRMED:** The ignored `.tmp` source archive SHA matches the third-party report; its 362 archive file hashes match `source-manifest.json`, all 362 local extracted copies match, and the 32 indexed source hashes match. This is **local** verification, not proof of remote availability or platform behavior.
- **CONFIRMED:** All 17 files were screened for private-key blocks, bearer/JWT shapes, common credential assignments, email/phone shapes and private IPv4 shapes; no heuristic match occurred. This is not a guarantee of no sensitive data, no proof of redistribution rights, and does not cover the external original attachment or entire ignored `.tmp` trees. No secret value is reproduced in this report.
- **CONFIRMED:** Current-machine paths referenced by report JSON exist locally. The engineering-plan Markdown links resolve locally, but 16 go to ignored `.tmp` material, six to currently untracked report files, and one to a Downloads attachment outside the repository. The third-party analysis has 32 links to ignored `.tmp` snapshots. A Git commit alone would not make these paths portable.
- **INFERRED:** None of these 17 files is required by the production runtime; they are diagnostic, proposal, test-record or provenance material. Static inventory is not a runtime dependency proof.
- **BLOCKED:** The original Downloads attachment was not audited for privacy or copied; its inclusion/redistribution is not authorized by this audit. Public upstream availability and current platform terms were not rechecked.

## Owner choice before the next cleanup unit

1. **Full historical evidence package (recommended default):** review repository visibility and local-path metadata, then include the 15 candidates/conditional artifacts together so report references remain coherent. Add a non-authoritative navigation note explaining historical dates, absolute paths and ignored `.tmp` dependencies. Do not rewrite byte-hashed Markdown silently or import third-party source archive.
2. **Slim historical package:** explicitly decide which generated artifacts may remain local-only, amend/supplement report references without falsifying the historical record, and check all links/hashes again. Do not simply delete the TAP, scripts, manifest or JSON because they are presently cited.

This is a retention/privacy and evidence-portability choice, not permission for real platform validation, policy activation or SHEEP-306. No platform-session code was touched. Controller review: NOT_RUN.

## Subsequent Owner decision

Owner chose B after this retention inventory. The candidate dispositions above were an earlier audit, **not** final staging advice. The 17 originals remain local and ignored; only the [redacted derivatives](public-inbound-evidence-2026-09-23/README.md) are staged under the [B cleanup report](evidence-publication-b-2026-09-23.md).
