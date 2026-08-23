// Clean-room implementation (TASK-017 M2). Public API of @fastwork/worker-rpc.
export { AIWorkerClient, type AIWorkerClientOptions, type WorkerEvent } from "./client/ai-worker-client.js";
export { PendingRequestRegistry } from "./client/pending-request-registry.js";
export { WriteQueue } from "./client/write-queue.js";
export { WorkerProcess } from "./client/worker-process.js";
export { RestartPolicy, DEFAULT_RESTART_POLICY, type RestartPolicyConfig } from "./client/restart-policy.js";
export { CLIENT_STATES, isTerminal, type ClientState } from "./client/client-state.js";
export { RPC_ERROR_CODES, RpcError, toRpcError, type RpcErrorShape, type RpcErrorCategory } from "./protocol/errors.js";
export {
  RPC_PROTOCOL_VERSION,
  READY_EVENT,
  DEFAULT_MAX_FRAME_BYTES,
  DEFAULT_MAX_INFLIGHT,
  DEFAULT_STARTUP_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  SYSTEM_METHODS,
} from "./protocol/constants.js";
export { JsonlDecoder, encodeFrame, type DecoderOptions } from "./protocol/framing.js";
export {
  validateRequest,
  validateResponse,
  validateEvent,
  validateWorkerReadyPayload,
  validateHealthResult,
} from "./protocol/validation.js";
export type {
  RpcRequest,
  RpcResponse,
  RpcEvent,
  RpcContext,
  WorkerSpawn,
  RequestOptions,
  WorkerReadyPayload,
  HealthResult,
  CancelResult,
  ShutdownResult,
  DecodeOutcome,
} from "./protocol/types.js";
