# @fastwork/legacy-import

Clean-room M11 (TASK-026) user-selected legacy data import + compatibility migration.

- Explicit user selection only — never auto-discovers legacy installation dirs.
- Legacy sources are READ-ONLY; the importer never modifies/deletes/renames them.
- Dry-run -> plan fingerprint -> explicit apply; backup before first mutation.
- Idempotent: repeated apply of the same source/plan adds zero duplicate rows.
- Main writes Main-owned aggregates; the Worker imports knowledge/candidates.
- Secrets: provider keys SKIP by default (SecretStore credential_ref on explicit
  consent); seller cookies/tokens/passwords are NEVER imported.
- Legacy FAISS is never canonical; knowledge import triggers a clean-room RAG rebuild.
- Imported query/executable skills are disabled + untrusted; scripts never executed.
