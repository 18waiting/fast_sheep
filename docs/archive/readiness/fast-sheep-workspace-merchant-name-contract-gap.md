# Workspace Merchant Name Contract Gap（SHEEP-063-PR2-PR1 Read First — BLOCKED）

> **历史 Read First 快照，非当前阻断状态**：下文 `BLOCKED` 记录 schema v8 要求编造商户名的旧缺口。后续 Owner 选定 Option B，[SHEEP-063-PR2-PR1](fast-sheep-workspace-merchant-identity-bootstrap.md) 经授权 migration 0009 以 nullable `merchants.name` 表示未知并获 `PASS`。原审计正文保留；当前状态/授权以 [PROJECT_STATE.json](../../project/PROJECT_STATE.json) 为准，不据此推断真实平台身份或商户名称。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 · 日期：2026-08-28
> 定位：SHEEP-063-PR2-PR1（Workspace Merchant Identity Bootstrap）执行前 Read First——核验现有 schema 能否在**不伪造事实**的前提下表达本地 workspace merchant 身份。
> 结论：**`DATA_CONTRACT_GAP-WORKSPACE_MERCHANT_NAME`** —— `merchants.name TEXT NOT NULL` 要求提供商户名，但本地 workspace merchant 在无 onboarding/registration 的可信输入时**无法诚实提供业务名称**；按收紧 #6/#12 明确指令 **STOP / 报告 contract gap**；不得编造商户名完成 bootstrap，也不自行 0009。
> 前置：PR2-PR1 已被 Owner 批准（创建权威 `MAIN_OWNED_LOCAL_WORKSPACE_IDENTITY_BOOTSTRAP`；持久化 `merchants` row + `app_meta.workspace_merchant_id`；保持 v8）。

## 1. 收紧要求（#6 / #12 原文语义）

- #6：若 Merchant schema 要求**无法诚实提供**的业务字段，不得编造商户名/成员/auth 等事实完成 bootstrap；STOP + 报告 contract gap。
- #12：schema v8 默认保持；若现有 schema 无法在不伪造事实的情况下表达该 identity，STOP；不以 config/UI convenience 绕过，也不自行 0009。

## 2. Read First 证据

| 检查项 | 结果 |
|---|---|
| `merchants` schema | `id TEXT PRIMARY KEY, name TEXT NOT NULL`（0005_identity_domain.sql）——**name 非空**，无默认值 |
| 本地 workspace merchant 的真实业务名称来源 | **无**（无 onboarding/注册流；config_groups/app_meta 无 merchant 名；无 `FASTWORK_MERCHANT_*` env） |
| 平台连接 / M11 import 提供商户名 | **无**（platform 服务仅 legacy shops；import 不写 identity domain） |
| 测试模式标签（`测试店铺A` 等） | **仅 test mode**，且属 legacy shops，不是 normalized merchant 业务名称；不可用于 production bootstrap |
| 能否以 NULL / 空串 / 生成 ID 冒充 name | **否**（NOT NULL 无默认；NULL/空串/ID 均非诚实业务名称，属编造） |

**结论**：现有 schema 的 `merchants.name NOT NULL` 在无可信商户身份输入时**无法诚实填充**。这是契约缺口，不是实现细节。

## 3. 影响

- PR2-PR1 的 bootstrap（首次未初始化 data root 创建 merchants 行，DP-99/101）被 name 契约阻断；按 #6/#12 **STOP**。
- PR2（WorkspaceMerchantContext）与 SHEEP-063 Timeline 继续不可实施（依赖 identity bootstrap）。
- 不改变 Message Fact path / Queue / schema（仍 v8）；不实现任何 product code。

## 4. 最小 next validation：Decision Package（Owner 决策）

**Option A（推荐，无 schema 变更）**：Owner 批准一个**中性的本地工作区标签**作为 bootstrap `merchants.name`（如 `"本地工作区"` / `"Local Workspace"`），并明确记录为 **workspace identity label，不是声明的业务名称**（产品决策：中性标签是否视为诚实表达）。schema 保持 v8；其余 PR2-PR1 设计要求（DP-99 稳定生成 ID / DP-100 pointer-only / DP-101 原子 / I-20、I-21 fail-closed / 不建 member/auth）不变。

**Option B（需 0009 授权）**：Owner 授权最小 0009 使 `merchants.name` 可空（或引入不含业务名称的 workspace-identity 契约），附迁移与测试。违反"默认保持 v8"，因此必须显式授权。

两者都不改变：创建权威 MAIN_OWNED、app_meta pointer、原子事务、dangling/ambiguous fail-closed、无 Member/Membership/auth 伪造、Platform 只 attach 不 define（DP-102）、Cloud 未来显式迁移（I-22）。

## 5. 边界（未实现/未改动）

- 未实现 identity bootstrap / WorkspaceMerchantContext / Timeline；未改 schema；未改 Queue；未实现 unread/priority/risk/composer/attachments/producer/sync。
- `UNREAD_FACT_READINESS` 保持 `PARTIALLY_READY / STILL_BLOCKED_BY_READER_PROGRESS`。
- 未读 reference/nixiang；未联网；无 secret/credential；Renderer 不接触 SQLite。
