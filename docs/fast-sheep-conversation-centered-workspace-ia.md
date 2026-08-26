# Fast Sheep Conversation-centered Workspace IA Proposal（SHEEP-042）

> 项目：Fast Sheep / 快羊客服 · Phase 3 / M3.1 · 日期：2026-08-27
> 定位：**纯 IA Proposal（产品代码变更 = 0）**；不挂载 AI primitive、不实现 Phase 4 workflow、不锁 Product/Order 最终 UI。
> 继承决策：DP-1~14 + I-1~I-3（`fast_sheep_ia_decisions` / `fast_sheep_multi_store_navigation_decisions`）。
> FastWork reference 仅作 workflow/behavior/IA inspiration，非最终视觉/几何/IA spec。

---

## 1. 本单元职责边界

- **只决定信息层级与关系**（hierarchy & relationships），**不锁定**固定栏位/宽度/永久三列/组件形态。
- Conversation 是 Agent 主工作台（DP-3）；Store 为工作范围维度（DP-9/11）；I-1~I-3 invariants 继续约束。

## 2. 工作台布局模型比较（DP-15，至少三种）

| 模型 | 描述 | 评估 |
|---|---|---|
| L-1 持续多栏 | 常驻 队列 + 会话 + 上下文 多栏 | 信息密度高，但易固化三列、与渐进披露冲突 |
| L-2 主会话 + 按需上下文 | 会话为主，上下文按需浮现（DP-6 渐进披露） | 贴合 AI-native + facts 始终可及（本提案初步倾向） |
| L-3 主会话全宽 + 专业 surface | 会话全宽，专业/上下文作为独立 surface | 会话沉浸强，但专业操作可达性依赖 surface 组织 |

> 本单元**不锁**任何固定栏位/宽度/永久三列；只定信息层级与关系。最终 topology 由 DP-15 决策 + 后续 IA 验证确定。

## 3. Conversation Queue（DP-16）

- **Conversation Queue = Agent Workspace 的 primary work-entry surface**（待处理/未读/AI 待审等队列维度），并受 **Store Scope 过滤**（DP-9/11）。
- **不锁定「左侧栏」**：具体 placement 后续决定（候选：侧栏 / 顶部 / 独立 panel）。

## 4. AI 建议放置（DP-18 + 原则）

- **原则：AI output attaches to the work object it assists** —— Agent 默认 AI assistance 应贴近对应**会话/任务/上下文**，而不是建立第二条独立 AI 聊天工作流。
- 独立 AI 管理入口仍属**管理 IA**（DP-2：AI-3 横切能力 + 管理入口；不因此自动挂载 SHEEP-031 primitive）。

## 5. Professional Fallback（DP-19）

- **不采用独立「professional mode」**。
- Professional fallback 必须 **continuously reachable**：通过 progressive disclosure 与快捷入口实现。
- **快捷键是 efficiency enhancement，不是进入专业能力的唯一方式**。

## 6. AI 建议的可核验性（DP-21 / invariant）

> **I-4：AI-assisted decisions must expose inspectable source facts/evidence without exposing hidden model reasoning.**
- 重要 AI 建议必须能查看其依据的**业务事实/来源**（可核验）；
- **不暴露模型 hidden chain-of-thought**（推理链不外泄）。

## 7. Workspace Queue State vs Active Conversation State（明确区分）

- **Workspace queue state**：待处理 / 未读 / AI 待审 / Store scope 过滤 等**队列维度**。
- **Active conversation state**：Ownership / Store / Order / AI suggestion 等**会话事实**。
- 两者**不得混为一类**：queue 状态驱动入口/计数；conversation 事实驱动会话上下文与动作（I-1 会话绑定自身 storeId）。

## 8. 上下文渐进披露（DP-17）

- 维持 `inline facts → context surface → full professional view` 的 progressive disclosure（DP-6）。
- **不锁** drawer / right-panel / popover 等具体组件形态。

## 9. Supervisor/Ops 关系（DP-20）

- Supervisor/Ops = **独立 IA domain**（DP-7），不嵌入 Agent 主工作区。
- Agent Workspace 可有**少量 escalation/transfer entry**（升级/转交入口），但不得把 Supervisor console 嵌成主工作区。

## 10. Decision Points（DP-15~21，待 Owner 决策）

| ID | 问题 | 候选 | 初步倾向（仅建议） |
|---|---|---|---|
| DP-15 | 工作台布局模型 | L-1 持续多栏 / L-2 主会话+按需上下文 / L-3 主会话全宽+专业 surface | L-2（只定层级，不锁栏位） |
| DP-16 | Conversation Queue 形态 | 侧栏 / 顶部 / 独立 panel（primary work-entry surface，Store-scope 过滤） | 不锁 placement；确认为 primary work-entry |
| DP-17 | 上下文渐进披露 | inline facts → context surface → full view（不锁组件） | 维持三级渐进披露 |
| DP-18 | AI 建议放置 | 附着工作对象（推荐）/ 独立 AI 聊天工作流（禁止） | AI output attaches to the work object；管理入口属管理 IA |
| DP-19 | Professional fallback 可达性 | continuously reachable（progressive disclosure + 快捷入口）/ 独立 professional mode（禁止） | continuously reachable；快捷键非唯一入口 |
| DP-20 | Supervisor/Ops 关系 | 独立 IA domain（推荐）/ 嵌入主工作区（禁止） | 独立 domain + 少量 escalation/transfer 入口 |
| DP-21 | AI 建议可核验性 | **I-4：expose inspectable source facts/evidence；不暴露 hidden chain-of-thought** | 必选 invariant |

## 11. Deferrals（本提案不锁定/不实现）

- 消息时间线 / 输入框 / 发送管道（Phase 4 M4.2）；上下文面板具体形态（M4.3 / DP-17 未来）；Command Palette（record-only）；Design System（M3.2）；SHEEP-031 AI Panel 挂载（后续单元）；Product/Order 最终 UI（M4.3）。

## 12. 证据等级与性质

- CONFIRMED：DP-1~14 + I-1~I-3（Owner 决策）；现有工作台结构；SHEEP-031 = unmounted primitive。
- INFERRED：布局/入口推导（低风险、可逆、仅文档）。
- PRODUCT_DECISION_REQUIRED：DP-15~21。
- 本提案不改变任何产品代码/导航/路由/挂载；reference-derived = NO。

## 13. 边界

- 未修改产品代码；未挂载 AI primitive；未实现 Phase 4；未锁 Product/Order 最终 UI。
- 未使用 FastWork reference 作视觉/几何/IA spec；未复制/未 eval/未联网/未 discovery/未读 nixiang。
- schema v7 不变；无 sync/Outbox。