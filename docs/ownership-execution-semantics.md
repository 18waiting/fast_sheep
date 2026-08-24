# Local Ownership Execution Semantics（M1.5-R02）

> 项目：Fast Sheep / 快羊客服 · Phase 1 / M1.5 · 状态：SEMANTICS（本地执行语义 + authority 边界）· 日期：2026-08-25

## 1. 范围

- 在 SHEEP-014 ownership domain（8 状态 + OwnershipActorRef）之上，定义 4 个治理确认动作
  （claim / release / handoff / supervisor_takeover）的**目标状态语义**（纯动作→目标状态契约）。
- **Actor ≠ Authority**：actor 只是执行主体身份；权限判断属 SHEEP-012 Capability + Resource Scope，
  **本任务不实现**。
- **supervisor_takeover 是动作/结果语义**，不代表 role=supervisor 自动有 takeover 权；无 role 硬编码。
- **动作语义 ≠ 完整 transition engine**：只有 4 个动作→目标状态映射，无 transition matrix /
  canTransition / 全状态组合规则（转换治理留后续 M1.5/Phase 4/12）。
- **AI_ACTIVE 仅 ownership 状态**，不推导 AI_AUTO_REPLY / ALLOW_AUTO / 任何 Automation/Entitlement。

## 2. 语义（packages/domain/src/ownership-execution.ts）

| 动作 | 目标状态 | 结果 owner |
|---|---|---|
| claim（member） | CLAIMED | 该 member |
| claim（ai） | AI_ACTIVE | ai |
| release | RELEASED | （无） |
| handoff | ASSIGNED | 目标 member |
| supervisor_takeover | SUPERVISOR_TAKEOVER | 执行 actor |

- handoff 缺 target → 通用错误（畸形请求，非权限判断）。
- 无任何 canClaim/canRelease/authorize/hasPermission 等权限函数；无 role/supervisor 检查。

## 3. DEFERRED（Phase 12 / 后续）

- lease duration / refresh / expiry；Cloud ownership authority；reconciliation；presence。
- 完整 authority validation（SHEEP-012 capability+resource scope）；自动化策略（Phase 7）。

## 4. 验收基线（本任务确认）

- 未导出 authority validation / permission engine；
- Actor identity 与 authority capability 隔离（无 SHEEP-012 耦合导出）；
- 不存在 role=supervisor 自动获得 takeover 的逻辑；
- schema v7 不变；未改 SHEEP-014 / persistence；无 sync/Outbox。