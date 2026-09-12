// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export {
  CONTRACT_SCHEMA_VERSION,
  WORKER_RPC_VERSION,
  PARITY_FIXTURE_VERSION,
  CONTRACTS_PACKAGE_VERSION,
} from "./versions.js";
export {
  loadRegistry,
  loadSchema,
  schemaPath,
  CONTRACTS_ROOT,
  SCHEMAS_ROOT,
  type ContractEntry,
  type ContractRegistry,
} from "./registry.js";
export {
  compileAllSchemas,
  validatorFor,
  type CompileReport,
} from "./validate.js";
export type {
  WorkerReadyPayload,
  HealthResult,
  CancelPayload,
  CancelResult,
  ShutdownResult,
  ProtocolErrorPayload,
} from "./generated/rpc.js";
export type {
  RetrievalRequest,
  RebuildIndexRequest,
  RebuildIndexResult,
  IndexStatusResult,
} from "./generated/rag.js";
export type {
  PddSessionStatus,
  PddSessionStatusValue,
  PddPageEventBase,
  PddSelectedCustomerObservedEvent,
  PddPageCommand,
  PddPageCommandType,
  PddPageCommandResult,
  PddCapabilities,
} from "./generated/platform-pdd.js";
export type {
  PlatformStatusView,
  PlatformActivateShopRequest,
  PlatformSetViewBoundsRequest,
  PlatformReloadRequest,
  PlatformStatusChangedEvent,
} from "./generated/desktop-platform.js";
export type {
  M8PlatformCapabilities,
  M8PlatformSessionStatus,
  M8PageEventBase,
  M8PageCommandBase,
  M8PageCommandResultBase,
} from "./generated/platform-m8.js";
