// M10 product-optimization types (clean-room).
export interface ProductRow { product_id: string; title: string; detail: string; shop: string; note: string; last_optimized_at?: string | null; }
export interface OptimizationProposal { product_id: string; detail: string; }
export interface ApplyResult { applied: boolean; reason?: string; backup_id?: string; }
export interface OptimizationEvent { product_id: string; event: string; }
