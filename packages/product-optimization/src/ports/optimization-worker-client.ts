// M10 optimization worker client port (clean-room). Worker proposes only.
export interface OptimizationWorkerClientPort {
  propose(request: Record<string, unknown>): Promise<Record<string, unknown>>;
}
