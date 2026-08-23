// @fastwork/product-optimization public surface (M10 clean-room).
export { ProductOptimizationService, type ProductOptimizationServiceOptions } from "./product-optimization-service.js";
export { guardDetail } from "./optimization-guards.js";
export { CooldownPolicy } from "./cooldown-policy.js";
export { BackupPolicy } from "./backup-policy.js";
export { OPT_ERROR_CODES, OptimizationError, type OptErrorCode } from "./errors.js";
export type { ProductRow, OptimizationProposal, ApplyResult } from "./types.js";
export type { ProductRepositoryPort, OptimizationWorkerClientPort, Clock, EventBus } from "./ports/index.js";
export { PersistenceProductRepository } from "./adapters/persistence-product-repository.js";
export { WorkerOptimizationClient } from "./adapters/worker-optimization-client.js";
