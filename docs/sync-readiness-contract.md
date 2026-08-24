# Sync-Readiness Persistence Contract（M1.5-R07）

> 项目：Fast Sheep / 快羊客服 · Phase 1 / M1.5 · 状态：CONTRACT（能力/契约级，非实现）· 日期：2026-08-24
> 核心硬边界：**sync-ready != sync-enabled**。本文只证明"架构可扩展"，不实现、不启用任何同步。

## 1. 目的

为未来 selected sync（Phase 12，SHEEP-220~224 Sync Engine / Outbox / Pull / Conflict）提供
**低成本接入条件**：Phase 1 已建立的稳定身份 + typed persistence boundary，使未来同步不需要对
大量既有表/repository/domain contract 做破坏性重写。

## 2. 能力（capability，文档级描述 —— 非 TS 对象、非字段、非表）

- **Change metadata 能力**：未来可**以新增方式**（forward migration）为选定实体加入 created/updated
  变更元数据；不锁字段名（不预设 created_at/updated_at），不强制所有实体拥有。
- **Entity revision 能力**：未来可为选定实体加入 revision/版本；不锁字段名，不强制所有表拥有
  sync revision，不要求所有实体有 cloud authoritative id。
- **Mutation boundary**：所有领域写入已通过 **typed repositories**（SHEEP-019-A/B/C）完成 —— 这是
  未来 change observation / Outbox 接入的**边界**；本契约不实现 revision generation、Outbox write、
  pending upload、Cloud call、sync-class evaluation，也不修改既有 repository 实现。

## 3. 消费既有身份（不制造第二套身份体系）

- 各实体稳定身份契约保持权威：Merchant / Store / PlatformAccount / Member / Membership / Seat /
  Conversation / Message / Customer / Product / Sku / Order / Logistics（SHEEP-010~017）。
- **无统一 Sync ID**；不给实体加 cloudRef/remoteRef；不复用 AccountRef 表达所有实体。
- AccountRef（SHEEP-010）仅保留其本义：身份引用 + local/platform/cloud 边界能力。

## 4. 治理级类型（TypeScript，仅真正可消费的）

`packages/domain/src/sync-readiness.ts`：
- `SyncClass` = `"cloud_authoritative" | "local_authoritative" | "replicated"`（Master §15 三分类）。
- `SyncClassPolicyHook` = 可选 `syncClass` 的 **policy integration point**；**不是 entity 字段**，
  不给任何实体/记录赋值（classification = M1.5-R06 DATA Gate）。
- `SyncReadiness` = `"ready" | "enabled"`：编码硬边界；本契约只可能处于/描述 `ready`，
  永远不产生 `enabled`。

## 5. 实体 readiness 映射（现状，CONFIRMED）

| 实体域 | 稳定身份（权威） | typed repository（mutation boundary） | 备注 |
|---|---|---|---|
| Merchant/Store/PlatformAccount | SHEEP-010 | 0005 + identity-repositories | — |
| Member/Membership/Seat | SHEEP-011 | 0005 + identity-repositories | Membership=唯一归属事实源 |
| Capability/ResourceScope/Role 组合 | SHEEP-012（domain contract） | **无持久化**（无证据，未建表） | 授权层能力 registry 未预置 |
| Conversation/Message/Ownership | SHEEP-013/014 | 0006 + conversation-repositories | Conversation storeId 已确认 |
| Customer | SHEEP-015 | 0007 + commerce-repositories | Store 语义 DEFERRED |
| Product/Sku | SHEEP-016 | 0007 + commerce-repositories | Sku→Product 单一事实源 |
| Order/Logistics | SHEEP-017 | 0007 + commerce-repositories | Logistics→Order 单一事实源 |

## 6. 明确不实现（Phase 12 范围）

- Outbox / pull / apply / retry / conflict / reconciliation / Cloud transport：**Phase 12（SHEEP-220~224）**。
- 任何 sync 字段/表（revision / deleted_at / remote_id / last_synced_at / pending_upload / Outbox）：
  **不创建**。
- 任何实体标记 sync-enabled / 获得 syncClass：**不发生**（R-06 gate 决定）。

## 7. R-06 门与 Phase 12 消费方式

- `sync-ready != sync-enabled`：本契约只建立"可加性"；是否同步、哪些实体同步，由 **M1.5-R06
  Data Authority / Sync Scope Matrix（DATA-DECISION-GATE）** 决定，Phase 12 前必须关闭。
- **Phase 12 如何消费**（规划，不实现）：
  1. 对 R-06 批准的实体，以其**既有稳定身份**注册 Sync Entity Contract（SHEEP-220）；
  2. 在既有 **typed repository 边界**挂接 change observation / Outbox（SHEEP-221），不改写业务写入路径；
  3. 通过新增 forward migration 为批准实体加入 revision / change metadata（SHEEP-018 计划的可加性）；
  4. 执行 Pull/Apply/Conflict/Retry（SHEEP-222~224）与 entity-specific sync policy（SHEEP-225~227）。

## 8. 验收基线（本任务执行时确认）

- schema version 仍为 v7；0001~0007 migration 无变化；
- 既有 domain/persistence implementation 无变化；
- 无实体被标记 sync-enabled；无实体获得 syncClass；无 Outbox/sync table；
- persistence regression 继续 PASS；文档明确 Phase 12 消费方式（上文 §7）。