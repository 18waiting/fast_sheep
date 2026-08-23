# @fastwork/worker-rpc

Clean-room M2 package (TASK-017): Electron/Node Main -> AIWorkerClient -> stdio JSONL RPC v1 -> Python AI worker.

## Scope

- stdio JSONL v1 framing (UTF-8, newline-delimited, bounded frame size).
- Worker process lifecycle: spawn, ready handshake, version negotiation, health,
  timeout, cancellation, backpressure, crash detection, bounded restart, graceful shutdown.
- Request/response correlation by request_id; out-of-order responses; structured events;
  stderr-only worker diagnostics.
- Typed envelope validation via @fastwork/contracts (JSON Schema 2020-12).

No AI/customer-service business logic: no RAG, prompt assembly, provider routing, LLM calls,
tool execution, handoff, conversation orchestration, platform adapters, or learning.

## Layout

```
src/protocol/   constants, framing (JsonlDecoder/encodeFrame), normalized errors, envelope validation, transport types
src/client/     PendingRequestRegistry, WriteQueue, WorkerProcess, AIWorkerClient, ClientState, RestartPolicy
tests/          Node test suite (node --test)
```

## Public API (src/index.ts)

```ts
import { AIWorkerClient, RPC_PROTOCOL_VERSION, RpcError, RPC_ERROR_CODES } from "@fastwork/worker-rpc";

const client = new AIWorkerClient({
  spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd, env: { FASTWORK_DATA_DIR, FASTWORK_RPC_TEST_MODE: "1" } },
  maxFrameBytes: 1024 * 1024,
  maxInFlight: 8,
});
await client.start();
const health = await client.health();
const echo = await client.request("test.echo", { text: "hi" }, { timeoutMs: 5000 });
client.subscribeEvents((ev) => console.log(ev.event));
await client.stop();
```

## Error model

Normalized RPC errors (`RpcError`) with wire codes matching frozen fixtures:
`version.unsupported`, `method.unknown`, `payload.oversize`, `cancelled`, `timeout`,
`worker_crashed`, `protocol_error`, `backpressure`, `not_ready`, `shutdown`, `startup_timeout`.
Categories are drawn from the canonical `fastwork:error` schema enum.

## Backpressure policy

`maxInFlight` bounded in-flight requests (default 8); when the limit is reached new
requests are rejected immediately with `rpc.backpressure` (bounded queue, never unbounded).

## Scripts

```
pnpm --filter @fastwork/worker-rpc typecheck
pnpm --filter @fastwork/worker-rpc test
pnpm --filter @fastwork/worker-rpc build
```
