// M10 worker job client adapter (clean-room). Maps domain RPC methods.
import type { WorkerJobClientPort } from "../ports/worker-job-client.js";
import type { AIWorkerClient } from "@fastwork/worker-rpc";

const METHOD_BY_TYPE: Record<string, string> = {
  learning: "learning.run",
  review: "review.propose",
  audit: "audit.decide",
  optimization: "optimization.propose",
};

export class WorkerJobClient implements WorkerJobClientPort {
  constructor(private readonly worker: AIWorkerClient) {}
  async run(type: string, request: Record<string, unknown>): Promise<Record<string, unknown>> {
    // A dotted `type` is already a full RPC method name (e.g. review.apply);
    // otherwise map the base job type to its canonical method.
    const method = type.includes(".") ? type : (METHOD_BY_TYPE[type] ?? type);
    return this.worker.request<Record<string, unknown>>(method, request);
  }
}
