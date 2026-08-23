// Clean-room implementation (TASK-017 M2). Envelope validation via @fastwork/contracts.
// JSON Schema definitions live only in @fastwork/contracts; this module never duplicates them.
import { validatorFor } from "@fastwork/contracts";
import type { RpcEvent, RpcRequest, RpcResponse, WorkerReadyPayload, HealthResult } from "./types.js";

interface ValidateResult {
  ok: boolean;
  errors: string[];
}

const cache = new Map<string, ReturnType<typeof validatorFor>>();

function v(id: string): ReturnType<typeof validatorFor> {
  let fn = cache.get(id);
  if (!fn) {
    fn = validatorFor(id);
    cache.set(id, fn);
  }
  return fn;
}

function check(id: string, instance: unknown): ValidateResult {
  const fn = v(id);
  const ok = fn(instance);
  return ok ? { ok: true, errors: [] } : { ok: false, errors: (fn.errors ?? []).map((e) => e.message ?? String(e)) };
}

export function validateRequest(req: unknown): ValidateResult {
  return check("fastwork:rpc:request", req);
}

export function validateResponse(res: unknown): ValidateResult {
  return check("fastwork:rpc:response", res);
}

export function validateEvent(ev: unknown): ValidateResult {
  return check("fastwork:rpc:event", ev);
}

export function validateWorkerReadyPayload(payload: unknown): ValidateResult {
  return check("fastwork:rpc:worker-ready-payload", payload);
}

export function validateHealthResult(result: unknown): ValidateResult {
  return check("fastwork:rpc:health-result", result);
}

export function validateCancelPayload(payload: unknown): ValidateResult {
  return check("fastwork:rpc:cancel-payload", payload);
}

export function validateProtocolErrorPayload(payload: unknown): ValidateResult {
  return check("fastwork:rpc:protocol-error-payload", payload);
}

export function assertValidRequest(req: unknown): asserts req is RpcRequest {
  const r = validateRequest(req);
  if (!r.ok) throw new Error("invalid RPC request: " + r.errors.join("; "));
}

export function assertValidResponse(res: unknown): asserts res is RpcResponse {
  const r = validateResponse(res);
  if (!r.ok) throw new Error("invalid RPC response: " + r.errors.join("; "));
}

export function assertValidEvent(ev: unknown): asserts ev is RpcEvent {
  const r = validateEvent(ev);
  if (!r.ok) throw new Error("invalid RPC event: " + r.errors.join("; "));
}

export function assertValidReadyPayload(payload: unknown): asserts payload is WorkerReadyPayload {
  const r = validateWorkerReadyPayload(payload);
  if (!r.ok) throw new Error("invalid worker ready payload: " + r.errors.join("; "));
}

export function assertValidHealthResult(result: unknown): asserts result is HealthResult {
  const r = validateHealthResult(result);
  if (!r.ok) throw new Error("invalid health result: " + r.errors.join("; "));
}
