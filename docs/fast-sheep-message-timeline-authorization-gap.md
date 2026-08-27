# Message Timeline Authorization Gap（SHEEP-063 Read First #2 — BLOCKED）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 · 日期：2026-08-28
> 定位：SHEEP-063（恢复后）执行前 Read First——核验 DP-91/I-17 所需的**独立 trusted merchant/workspace context** 是否存在于当前 Main runtime。
> 结论：**`DATA_AUTHORIZATION_GAP-TIMELINE-WORKSPACE_MERCHANT_CONTEXT`** —— Main 目前**没有**独立于 Queue Scope / selected shop 的可信 merchant/workspace 授权上下文；按 DP-91 明确指令 **STOP / report gap**，不实现 Timeline，不用 selected shop 冒充。
> 前置：SHEEP-063-PR1 已关闭（Message Fact path READY）；Timeline 数据路径已就绪，**授权边界缺失**是剩余阻断项。

## 1. 为什么需要独立授权上下文（DP-91 + I-17）

- Renderer 提供的 `conversation_id` 是 **untrusted selector**（Master §10：不得信任 client-supplied identity 作为 authorization）。
- Timeline query 必须：resolve Conversation → 经**可信 merchant/workspace boundary** 授权 → 才读取 `normalized_messages`。
- I-17：Queue Scope（Store/Platform filter / selected shop）是**查询维度**，不是 Active Conversation 的 authority。不得用 Queue scope 冒充 Timeline 授权。

## 2. Read First 证据（为何缺上下文）

| 检查项 | 结果 |
|---|---|
| Main 是否存在 `currentMerchant` / `workspaceMerchant` / `merchantContext` / `currentWorkspace` 概念 | **否**（全仓无此概念） |
| Main/bootstrap/worker-runtime 是否构造或注入 `MerchantRepository` / `SqliteMerchantRepository` | **否**（identity domain 仅在 persistence 包与测试中使用） |
| 是否有独立 Main-owned "active workspace" 状态 | **否**（无 session/workspace bootstrap；`app-lifecycle.ts` 仅 window 生命周期） |
| data root 是否按 merchant 隔离 | **否**（`resolveDataRoot` = 单一全局路径 `%LOCALAPPDATA%\fast_sheep\data`；无 per-merchant 数据根） |
| seed 是否创建本地 merchant/workspace 身份 | **否**（`seedDefaults` 仅 config_groups；不建 merchants 行） |
| 既有 merchant 锚点来源 | 仅 Queue handler 用 `selectedShopId → store → merchantId`（SHEEP-060/061 **provisional**；I-17/DP-91 明确禁止用于 Timeline authority） |
| 现有 conversation merchant 边界 | 仅 `listByMerchant/listByStore` 的 repo 过滤（I-6 底层证据）；**没有"当前 workspace 是哪个 merchant"的 Main 侧事实** |

**结论**：当前 Main 唯一能拿到的 merchant 锚点是 provisional selected shop（Queue Scope），这正是 I-17/DP-91 禁止用于 Active Conversation 授权的东西。因此 Timeline 若此刻实现，只能：a) 用 selected shop 冒充（违反 I-17/DP-91），b) 不做授权（违反 Master §10 / DP-91），或 c) 引入伪造的 renderer merchant 参数（违反 Master §10）。三者都不可接受 → **STOP**。

## 3. 影响与最小 next validation

- Timeline 无法在本轮安全落地；`conversations.listMessages` typed IPC / Timeline UI / stale guard / visual evidence 全部保持**未实现**。
- 最小 prerequisite：**SHEEP-063-PR2 — Workspace Merchant Context Foundation**（见提案），建立 Main-owned、非 renderer 可控、独立于 Queue Scope 的可信 active-workspace merchant 上下文，并给出 Owner 决策点（本地 workspace 如何认定 merchant：单商户本地工作区假设 vs 显式选择；test-mode 合成上下文；PR2 不实现 auth/cloud/entitlement）。
- PR2 不改变 Message Fact path；schema 仍 v8；无 0009。

## 4. 边界（未实现/未改动）

- 未实现 Timeline IPC/UI/visual；未改 schema；未改 Queue ordering；未实现 unread/priority/risk/composer/attachments/producer/sync。
- `UNREAD_FACT_READINESS` 保持 `PARTIALLY_READY / STILL_BLOCKED_BY_READER_PROGRESS`。
- 未读 reference/nixiang；未联网；无 secret/credential；Renderer 不接触 SQLite。
