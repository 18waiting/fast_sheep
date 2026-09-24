# Workspace Merchant Identity Bootstrap Gap（SHEEP-063-PR2 Read First — BLOCKED）

> **历史 Read First 快照，非当前阻断状态**：下文 `BLOCKED` 是本地 workspace merchant bootstrap 建立**之前**的审计结论。后续 [SHEEP-063-PR2-PR1 Identity Bootstrap](fast-sheep-workspace-merchant-identity-bootstrap.md) 和 [PR2 Context](fast-sheep-workspace-merchant-context.md) 获 `PASS`；当前状态以 [PROJECT_STATE.json](../../project/PROJECT_STATE.json) 为准。该本地身份基础**不等于** SHEEP-305 的平台身份/店铺绑定已验证或真实操作获授权。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 · 日期：2026-08-28
> 定位：SHEEP-063-PR2（Workspace Merchant Context Foundation）执行前 Read First——核验生产环境是否存在**可信 local bootstrap/identity source** 可显式 resolve Workspace Merchant（DP-94/95/96）。
> 结论：**`DATA_IDENTITY_BOOTSTRAP_GAP-WORKSPACE_MERCHANT`** —— 当前**不存在**任何可信本地 merchant identity bootstrap；按 PR2 收紧 #4/#11 明确指令 **STOP / report gap / 另提最小 identity-bootstrap prerequisite**；不得创造 magic `"default"` merchant、first-row fallback、selected-shop fallback 或 UI/config convenience 绕过。
> 前置：SHEEP-063 Read First #1（消息事实缺口 → PR1 已关闭）、Read First #2（授权上下文缺口 → PR2 已批准）；授权上下文（PR2）消费 identity bootstrap，因此 bootstrap 必须先于/伴随 PR2 生产接线。

## 1. PR2 生产组合要求（收紧 #4/#11 原文语义）

- Production composition 必须从**可信 local bootstrap/identity source** 显式 resolve merchantId，并**验证 Merchant 存在**。
- 若不存在任何可信 source/identity bootstrap → STOP + 报告最小 identity-bootstrap gap。
- 若可信 local workspace merchant identity 无法在现有事实中建立且确需新 persistence contract → STOP + 另提最小 identity-bootstrap prerequisite。
- 禁止：magic `"default"` merchant、first-row fallback、count==1 推断、selected-shop/Queue Scope 推断（DP-96）、UI/config convenience。

## 2. Read First 证据

| 检查项 | 结果 |
|---|---|
| `FASTWORK_MERCHANT_*` / merchant identity env | **无**（现有 env 仅 DATA_ROOT、smoke/test flags、worker 路径） |
| 生产代码创建 `merchants` 行 | **无**（`SqliteMerchantRepository.save` 仅在测试中使用；Main/bootstrap/worker-runtime 未接线） |
| onboarding / first-run / 注册流创建本地 merchant | **无** |
| 平台连接（PDD/DouDian 等）创建 merchant | **无**（platform 服务仅 legacy shops/会话，不写 normalized identity） |
| M11 legacy import 创建 normalized merchant | **否**（只写 legacy shops/products/conversations 等） |
| config_groups / app_meta 含 workspace merchant 引用 | **无**（app_meta 仅 database_schema_version/updated_at） |
| `merchants` 表在生产实际存在行 | **否**（表存在但生产无行） |

**结论**：生产环境没有任何可信来源可显式 resolve Workspace Merchant。`merchants` 表/`app_meta` 等 persistence 契约虽已存在，但**没有 bootstrap 流在可信前提下创建/记录本地 workspace merchant identity**——这是明确的最小 identity-bootstrap 缺口，不是实现细节。

## 3. 影响

- PR2（WorkspaceMerchantContext）的**生产组合**无法满足收紧 #4（resolve + verify Merchant exists）→ PR2 生产接线在 identity bootstrap 就绪前**无法安全落地**。
- Timeline（SHEEP-063 恢复）继续不可实施（依赖 PR2 授权上下文 + identity bootstrap）。
- 不改变 Message Fact path（schema v8）；Queue/Store/Platform 行为不变（DP-98 的 Queue 迁移属于 PR2 落地后步骤，本轮不动）。

## 4. 最小 next validation（提案：SHEEP-063-PR2-PR1 — Workspace Merchant Identity Bootstrap）

见提案文本。核心 Owner 决策点：
1. 本地 workspace merchant 的**创建权威/可信来源**：`MAIN_OWNED_FIRST_RUN_BOOTSTRAP`（Main 在首次运行时从显式可信输入建立单一本地 merchant 身份） vs `PLATFORM_CONNECTION_CREATES_MERCHANT`（未来 PDD/DouDian 连接时建 merchant） vs `CLOUD_REGISTRATION`（未来 Phase 12）。
2. workspace merchant 引用的持久化契约：`app_meta` key（`workspace_merchant_id` + verified `merchants` row，复用现有表 → schema v8 可保持） vs 新表/新 migration（需另行授权 0009）。
3. 约束：PR2-PR1 不实现 auth/cloud/entitlement/session UI/multi-merchant selector；不改变 Queue/UI semantics；test mode 合成身份仅测试注入，production 不 fallback。

## 5. 边界（未实现/未改动）

- 未实现 WorkspaceMerchantContext / Timeline IPC/UI / identity bootstrap；未改 schema；未改 Queue ordering/UI；未实现 unread/priority/risk/composer/attachments/producer/sync。
- `UNREAD_FACT_READINESS` 保持 `PARTIALLY_READY / STILL_BLOCKED_BY_READER_PROGRESS`。
- 未读 reference/nixiang；未联网；无 secret/credential；Renderer 不接触 SQLite。
