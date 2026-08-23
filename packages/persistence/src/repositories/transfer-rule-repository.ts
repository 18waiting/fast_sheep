// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface TransferRuleRecord { id?: number; keyword: string; transfer_to: string; transfer_message: string; work_hours: string; source_agent: string; status: string; order_state: string; applicable_shops: string; sort_order: number; enabled: boolean; }
export interface TransferRuleRepository { list(): TransferRuleRecord[]; save(r: TransferRuleRecord): void; remove(id: number): void; }
