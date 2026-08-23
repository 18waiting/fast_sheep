# @fastwork/persistence

Clean-room M1 persistence package (TASK-016). Canonical business state lives in a single
SQLite database at `<DATA_ROOT>/fastwork.sqlite3`.

## Scope

- SQLite foundation (injectable data root, PRAGMAs, integrity check).
- Migration framework (ordered SQL migrations + SHA-256 checksums + transactional runner).
- 11 repository interfaces, 11 SQLite implementations, 11 in-memory test doubles.
- Single-writer ownership (MAIN tables vs WORKER knowledge tables).
- Node/Python shared SQLite compatibility (worker uses stdlib `sqlite3`).

No AI/customer-service business logic is implemented here (no RAG, provider routing,
prompt assembly, handoff, platform automation, orchestration, or learning).

## Layout

```
src/db/            data root, sqlite driver, pragmas, database init, transactions, errors, schema version
src/migrations/    migration types, loader, runner, backup
src/repositories/  11 repository interfaces
src/sqlite/        11 SQLite repository implementations
src/memory/        11 in-memory repository implementations
migrations/        SQL migration files (0001_initial.sql = schema v1)
tests/             Node test suite (node --test)
```

## Data Root

Resolution precedence: explicit runtime override > `FASTWORK_DATA_DIR` env >
platform application-data default. `resolveDataRoot` normalizes to an absolute path,
provisions required directories, and write-probes the root. Logical database file:
`<DATA_ROOT>/fastwork.sqlite3`.

## PRAGMAs

- `PRAGMA foreign_keys = ON`
- `PRAGMA journal_mode = WAL`
- `PRAGMA busy_timeout = 5000`
- `PRAGMA synchronous = NORMAL`

## Migrations

Migrations are ordered by numeric prefix (`0001_initial.sql`). Each applied migration is
recorded in `schema_migrations` (version, name, checksum, applied_at). The runner
supports fresh install, current-DB no-op, checksum validation, transactional
apply/rollback, future-schema rejection, and backup-before-upgrade
(`<DATA_ROOT>/backups/db/<timestamp>/fastwork.sqlite3`).

## Single-Writer Ownership

- MAIN (TypeScript) writes: shops, config_groups, products, conversations,
  conversation_messages, prompt_profiles, skills, product_skill_mounts, transfer_rules,
  forbidden_words, feedback_records, stats, background_jobs.
- WORKER (Python) writes: knowledge_entries, knowledge_candidates.
- Node persistence does not export a knowledge mutation implementation; Python
  persistence does not export product/settings mutation implementations (tested).

## Repository Interfaces

`ShopRepository`, `SettingsRepository`, `ProductRepository`,
`ConversationRepository`, `PromptRepository`, `SkillRepository`,
`TransferRuleRepository`, `ForbiddenWordRepository`, `FeedbackRepository`,
`StatsRepository`, `JobRepository`.

## Validation & Seeding

Settings payloads are validated against M0 JSON schemas (@fastwork/contracts) before
commit; invalid payloads cause no DB mutation. Defaults are insert-if-missing and never
overwrite user values (idempotent seeding).

## Scripts

```
pnpm --filter @fastwork/persistence typecheck
pnpm --filter @fastwork/persistence test
pnpm --filter @fastwork/persistence build
```
