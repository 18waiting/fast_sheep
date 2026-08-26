# Fast Sheep Multi-store Navigation Model Proposal（SHEEP-041）

> 项目：Fast Sheep / 快羊客服 · Phase 3 / M3.1 · 日期：2026-08-27
> 定位：**纯 IA Proposal（产品代码变更 = 0）**；不改 shop-sidebar、不改 typed selection、不实现 queue/Command Palette/Phase 4 workflow。
> 产品方向：AI-native workflow + Professional fallback；继承 `fast_sheep_ia_decisions`（DP-1~8）。
> FastWork reference 仅作 workflow/behavior/IA inspiration，非最终视觉/几何/IA spec。

---

## 1. 核心 Invariants（本提案约束）

- **I-1 Conversation-bound context wins over ambient store selection**：打开具体 Conversation 后，其 `storeId` 是业务上下文事实来源；全局/ambient store selection **不得静默改变**该会话的 Customer/Product/Order/Platform/AI context。
- **I-2 All Stores is a work queue scope, not a data ownership scope**：`All Stores` 仅为 workspace/queue query scope，**不是 Store identity**；不得设计伪 `storeId="all"`。
- **I-3 No ambiguous cross-store action（DP-14）**：任何 business-impacting action 必须拥有明确 target Store；AI suggestion/action 不得混合不同 Store 的事实上下文。

## 2. Store Selection vs Conversation Context（DP-11 重写）

- **Store selection 的作用 = 过滤 workspace entry/queue**（如收件箱/队列按所选 Store 或 All Stores 查询）。
- **Active Conversation 始终绑定自身 Store identity**（其 `storeId` 为该会话上下文事实源）。
- 两者职责分离：ambient store selection ≠ conversation context；切换 ambient store **不得**改写已打开会话的上下文。

## 3. 店铺导航模型比较（DP-9）

| 模型 | 描述 | 评估 |
|---|---|---|
| M-1 平面全局店铺列表 | 现有 shop-sidebar 式列表 | 简单，但与 AI-native 工作流弱绑定 |
| M-2 平台分组（全部/PDD/DouDian） | Roadmap candidate；按平台分组 | 仅作 platform-grouping **candidate**，不得硬编码为永久 IA taxonomy（未来须支持可扩展 `PlatformId`） |
| M-3 **context-aware workspace + explicit professional store switcher（推荐）** | Agent 工作流按 Conversation context 组织；店铺切换为显式 professional 控件；AI 可建议但**不隐式改变 Store scope** | 贴合 DP-3/DP-8 + I-1/I-3（本提案初步倾向） |

> **不使用「AI 自动决定店铺上下文」语义**：AI 可提出切店建议，但 Store scope 变更必须显式且经用户确认（DP-12）。

## 4. Navigation Preference vs Business Fact（DP-12）

- **Business fact**：Conversation/action 的 `storeId` 为事实源（不可由 UI preference 覆盖）。
- **Navigation preference**：用户显式选择的店铺 / 记住的最近店铺 —— 仅影响 workspace entry/queue 默认视图，**不是**业务事实。
- 推荐：`explicit selection + optional remembered navigation preference`。
- **禁止**：AI inferred automatic store switching；未来 AI 可提切店建议，但需用户确认。

## 5. Agent Workspace 双 scope 模型（仅 IA，不实现）

- 同时支持 **All Stores queue scope**（工作队列按全部店铺查询；不隐含数据所有权）与 **Specific Store scope**（按选定店铺过滤队列/入口）。
- 两者均为 workspace query/entry scope；不影响已打开 Conversation 的 `storeId` 上下文（I-1）。

## 6. Decision Points（DP-9~14，待 Owner 决策）

| ID | 问题 | 候选 | 初步倾向（仅建议） |
|---|---|---|---|
| DP-9 | 店铺导航模型 | M-1 平面 / M-2 平台分组 / M-3 context-aware + explicit switcher | M-3（AI 可建议，不隐式改 Store scope） |
| DP-10 | 店铺切换器放置 | 现有 app-sidebar / Command Palette（record-only）/ 二者结合 | 现有 sidebar + 未来 Command Palette 深链（record-only） |
| DP-11 | Store selection 作用关系 | 过滤 workspace queue/entry（推荐）/ 改写会话上下文（禁止） | **过滤 workspace entry/queue；active Conversation 绑定自身 Store identity** |
| DP-12 | 默认/最近店铺 | 显式 + 可选记忆（推荐）/ AI 自动推断（禁止） | 显式选择 + optional remembered navigation preference；AI 切店建议需确认 |
| DP-13 | Supervisor/Ops 店铺范围 | merchant-wide aggregate + Store/Platform filtering（推荐）/ 其它 | merchant-wide aggregate + filtering；可见范围由 Capability/ResourceScope 决定（IA 不授 authority） |
| DP-14 | 跨店动作 ambiguity | **No ambiguous cross-store action**（必选 invariant） | 任何 business action 须明确 target Store；AI 不得混合多 Store 事实 |

## 7. Platform Grouping（Roadmap 全部/PDD/DouDian）

- 仅作 **platform-grouping candidate**，不得硬编码为永久 IA taxonomy。
- Platform 分组未来必须支持**可扩展 `PlatformId`**（PDD/DouDian 为 Tier-1 起点，非穷尽枚举）。

## 8. Deferrals（本提案不锁定/不实现）

- queue 实现 / Command Palette 实现 / Phase 4 workflow：均**不实现**（仅 IA 讨论）。
- Product/Order IA：M4.3。
- Design System（tokens/typography/spacing/color/components）：M3.2。
- SHEEP-031 AI Panel 挂载：后续单元（unmounted primitive）。

## 9. 证据等级与性质

- CONFIRMED：Roadmap 多店铺候选；现有 shop-sidebar 数据/切换机制；DP-1~8 决策；I-1~I-3 invariant（本提案原则，待 Owner 确认）。
- INFERRED：模型/入口推导（低风险、可逆、仅文档）。
- PRODUCT_DECISION_REQUIRED：DP-9~14。
- 本提案不改变任何产品代码/导航/路由/选择逻辑；reference-derived = NO。

## 10. 边界

- 未修改产品代码；未改 shop-sidebar / typed selection；未实现 queue/Command Palette/Phase 4。
- 未使用 FastWork reference 作视觉/几何/IA spec；未复制/未 eval/未联网/未 discovery/未读 nixiang。
- schema v7 不变；无 sync/Outbox。