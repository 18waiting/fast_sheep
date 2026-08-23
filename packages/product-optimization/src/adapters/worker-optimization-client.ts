// M10 worker optimization client adapter (clean-room). Worker proposes only.
import type { AIWorkerClient } from "@fastwork/worker-rpc";
import type { OptimizationWorkerClientPort } from "../ports/index.js";
export class WorkerOptimizationClient implements OptimizationWorkerClientPort {
  constructor(private readonly worker: AIWorkerClient) {}
  async propose(request: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.worker.request<Record<string, unknown>>("optimization.propose", request);
  }
}
