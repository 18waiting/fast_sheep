// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// Public exports: DB infrastructure contracts, repository interfaces, SQLite + in-memory
// implementations, normalized errors. Raw driver internals are not exported.

// DB infrastructure
export { PersistenceError, ERROR_CODES } from "./db/errors.js";
export { resolveDataRoot, provisionDataRoot, DATA_ROOT_ENV, DB_FILENAME, type DataRoot } from "./db/data-root.js";
export { SqliteConnection, type SqlParam } from "./db/sqlite-driver.js";
export { applyPragmas, PRAGMAS, type Pragmas } from "./db/pragmas.js";
export { openDatabase, quickCheck, type PersistenceContext } from "./db/database.js";
export { runInTransaction } from "./db/transaction.js";
export { SUPPORTED_DB_SCHEMA_VERSION, isSchemaSupported, assertSchemaSupported } from "./db/schema-version.js";

// Migrations
export { MigrationRunner, MIGRATIONS_DIR } from "./migrations/migration-runner.js";
export { discoverMigrations, maxMigrationVersion } from "./migrations/migration-loader.js";
export { backupDatabase } from "./migrations/database-backup.js";
export type { Migration, MigrationRecord, MigrationResult } from "./migrations/migration-types.js";

// Config validation + defaults
export { validateConfigGroup, CONFIG_GROUP_SCHEMA_IDS } from "./config-validate.js";
export { seedDefaults, defaultConfigGroups, type ConfigDefault } from "./seed.js";

// Repository interfaces
export type * from "./repositories/shop-repository.js";
export type * from "./repositories/settings-repository.js";
export type * from "./repositories/product-repository.js";
export type * from "./repositories/conversation-repository.js";
export type * from "./repositories/prompt-repository.js";
export type * from "./repositories/skill-repository.js";
export type * from "./repositories/transfer-rule-repository.js";
export type * from "./repositories/forbidden-word-repository.js";
export type * from "./repositories/feedback-repository.js";
export type * from "./repositories/stats-repository.js";
export type * from "./repositories/job-repository.js";

// SQLite implementations
export { SqliteShopRepository } from "./sqlite/sqlite-shop-repository.js";
export { SqliteSettingsRepository } from "./sqlite/sqlite-settings-repository.js";
export { SqliteProductRepository } from "./sqlite/sqlite-product-repository.js";
export { SqliteConversationRepository } from "./sqlite/sqlite-conversation-repository.js";
export { SqlitePromptRepository } from "./sqlite/sqlite-prompt-repository.js";
export { SqliteSkillRepository } from "./sqlite/sqlite-skill-repository.js";
export { SqliteTransferRuleRepository } from "./sqlite/sqlite-transfer-rule-repository.js";
export { SqliteForbiddenWordRepository } from "./sqlite/sqlite-forbidden-word-repository.js";
export { SqliteFeedbackRepository } from "./sqlite/sqlite-feedback-repository.js";
export { SqliteStatsRepository } from "./sqlite/sqlite-stats-repository.js";
export { SqliteJobRepository } from "./sqlite/sqlite-job-repository.js";

// In-memory implementations (test doubles)
export { InMemoryShopRepository } from "./memory/memory-shop-repository.js";
export { InMemorySettingsRepository } from "./memory/memory-settings-repository.js";
export { InMemoryProductRepository } from "./memory/memory-product-repository.js";
export { InMemoryConversationRepository } from "./memory/memory-conversation-repository.js";
export { InMemoryPromptRepository } from "./memory/memory-prompt-repository.js";
export { InMemorySkillRepository } from "./memory/memory-skill-repository.js";
export { InMemoryTransferRuleRepository } from "./memory/memory-transfer-rule-repository.js";
export { InMemoryForbiddenWordRepository } from "./memory/memory-forbidden-word-repository.js";
export { InMemoryFeedbackRepository } from "./memory/memory-feedback-repository.js";
export { InMemoryStatsRepository } from "./memory/memory-stats-repository.js";
export { InMemoryJobRepository } from "./memory/memory-job-repository.js";

// SHEEP-019-A: Phase 1 identity domain persistence.
export type { MerchantRecord, StoreRecord, PlatformAccountRecord, MemberRecord, MembershipRecord, SeatRecord, MerchantRepository, StoreRepository, PlatformAccountRepository, MemberRepository, MembershipRepository, SeatRepository } from "./repositories/identity-repositories.js";
export { SqliteMerchantRepository, SqliteStoreRepository, SqlitePlatformAccountRepository, SqliteMemberRepository, SqliteMembershipRepository, SqliteSeatRepository } from "./sqlite/sqlite-identity-repositories.js";

// SHEEP-019-B: conversation domain persistence.
export type { NormalizedConversationRecord, MessageRecord, OwnershipRecord, NormalizedConversationRepository, MessageRepository, OwnershipRepository } from "./repositories/conversation-repositories.js";
export { SqliteNormalizedConversationRepository, SqliteMessageRepository, SqliteOwnershipRepository } from "./sqlite/sqlite-conversation-repositories.js";
