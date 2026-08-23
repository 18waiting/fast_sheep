// M10 optimization errors (clean-room).
export const OPT_ERROR_CODES = { NOT_FOUND: "optimization.not_found", GUARD_REJECTED: "optimization.guard_rejected", COOLDOWN: "optimization.cooldown", BACKUP_FAILED: "optimization.backup_failed" } as const;
export type OptErrorCode = (typeof OPT_ERROR_CODES)[keyof typeof OPT_ERROR_CODES];
export class OptimizationError extends Error { readonly code: string; constructor(code: string, message: string) { super(message); this.name = "OptimizationError"; this.code = code; } }
