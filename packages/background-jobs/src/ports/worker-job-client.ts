// M10 worker job client port (clean-room). Narrow RPC surface per domain.
export interface WorkerJobClientPort {
  run(type: string, request: Record<string, unknown>): Promise<Record<string, unknown>>;
}
