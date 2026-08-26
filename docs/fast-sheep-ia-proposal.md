# Fast Sheep IA Proposal（SHEEP-040）

> 项目：Fast Sheep / 快羊客服 · Phase 3 / M3.1 · 日期：2026-08-26
> 定位：**纯 IA Proposal（产品代码变更 = 0）**；不挂载 SHEEP-031 AI primitive、不实现路由、不提前实现 Phase 4。
> 产品方向：**Fast Sheep = AI-native workflow + Professional fallback**（AI first / facts always available / human always in control；AI suggestion ≠ authority）。
> FastWork reference 仅作 workflow/behavior/IA inspiration，**非最终视觉/几何/IA spec**。

---

## 1. Candidate Domains（CONFIRMED roadmap candidate domains，非最终导航）

Roadmap M3.1 建议的一级导航候选（**仅 CONFIRMED as roadmap candidate domains**，不得默认视为最终 9 个一级导航）：

`工作台 / 会话 / AI / 客户 / 商品 / 订单 / 知识库 / 团队 / 设置`

- 本提案**不**假定上述 9 项全部进入一级导航；最终集合与顺序由 Owner 决策点决定（见 §6）。
- Product/Order：仅确认 **domain importance（CONFIRMED）**；其 primary-nav/contextual-role 最终决定 **DEFER 到 Phase 4 M4.3**，本提案不锁定。

## 2. 三种 IA 模型比较（至少三选一并分析）

| 维度 | 模型 A：Domain-first Professional Console | 模型 B：Workflow-first AI-native | 模型 C：Hybrid AI-native workflow + Professional fallback |
|---|---|---|---|
| 导航组织 | 按 domain/table 映射菜单（会话/客户/商品/订单/知识库…） | 按 workflow/状态组织（收件箱→处理→AI 建议→人工复核→上下文） | AI-native 主流程为第一入口 + 专业功能按需 fallback/管理入口 |
| 优点 | 信息密度高、可预测、传统客服习惯 | 贴合 AI 优先意图、减少重复操作、facts 按需呈现 | 兼顾 AI 效率与专业可控/可核验 |
| 缺点 | 易形成“菜单=表”，与 AI 工作流割裂；contextual 入口弱 | 对传统专业操作可能过度包装；专业指标/队列可见性弱 | 需精细设计入口分层，避免双轨混乱 |
| 与产品方向匹配 | 低（专业但非 AI-native） | 中（AI-native 但 fallback 弱） | **高（本提案初步倾向）** |

**结论**：本提案以 **模型 C（Hybrid）** 为主要候选方向，但最终选择由 Owner 决策点 DP-1 决定。

## 3. 入口类型分层（Entry Types）

IA 不得简单按 domain/table 映射菜单，必须区分三类入口：

1. **Primary workflow entry**：日常 AI-native 工作流入口（如：会话工作台 / AI 建议处理流）。
2. **Contextual entry**：在上下文中按需浮现的入口（如：会话中的客户/商品/订单上下文；AI 建议旁的核验面板）——不是独立一级菜单。
3. **Administrative / professional entry**：管理与专业 console（如：团队、审计、指标、设置、知识库管理、平台状态）。

> 候选 domain 将按「入口类型」归位，而非一一对应一级菜单；具体归位由 DP-3~DP-8 决定。

## 4. Professional fallback ≠ Supervisor/Ops（分别讨论）

- **Agent professional fallback**：一线客服在 AI-native 流程中需要的手动操作/键盘效率/原始事实核验/降级路径（AI 建议不可用或需人工确认时的专业操作面）。
- **Supervisor/Ops console**：管理视角的高信息密度专业 console（队列、状态、指标、审计、异常处理、团队管理）——独立于一线 Agent 的 fallback。

> 两者是**不同的 IA 区域**，本提案分开设计；其 IA 边界由 DP-7 决定。

## 5. AI 的 IA 角色（三种选项比较）

| 选项 | 描述 | 评估 |
|---|---|---|
| AI-1：一级模块 | AI 作为独立一级导航工作页（如 Roadmap 的“AI”） | 简单直观，但可能割裂 AI 与工作流的嵌入式能力 |
| AI-2：纯横切 | AI 能力完全嵌入各工作流（建议/上下文/核验），无独立入口 | 最贴合 AI-native，但 AI 状态/管理/设置缺乏聚合入口 |
| AI-3：横切能力 + 独立管理入口 | AI 建议/生成嵌入工作流（横切）+ 保留 AI 配置/状态/管理入口 | 兼顾体验与可管理性（本提案初步倾向） |

> **不因 Roadmap 有“AI”就默认建立独立 AI 工作页**；由 DP-2 决定。

## 6. Owner Decision Points（DP 清单，全部待 Owner 决策）

| ID | 决策问题 | 候选选项 | 初步倾向（仅建议） |
|---|---|---|---|
| DP-1 | IA 模型 | A 专业 console / B workflow-first AI-native / C Hybrid | C（Hybrid） |
| DP-2 | AI 的 IA 角色 | AI-1 一级模块 / AI-2 纯横切 / AI-3 横切+管理入口 | AI-3 |
| DP-3 | 工作台与会话的关系 | 会话即工作台主区 / 工作台为聚合页+会话为其中模块 / 其它 | 会话即主工作台（AI-native 主流程） |
| DP-4 | Customer 入口角色 | 一级入口 / contextual entry（会话中浮现）/ 二者结合 | contextual + 管理列表入口 |
| DP-5 | Product/Order 候选角色 | 一级 / contextual / 其它 —— **最终决定 DEFER 到 M4.3**，本项仅记录候选范围 | 记录候选，不锁定 |
| DP-6 | Agent professional fallback 原则 | 内嵌于工作流 / 独立 fallback 模式 / 快捷键优先 | 内嵌 + 快捷键优先 |
| DP-7 | Supervisor/Ops IA domain | 独立一级 console / 与工作台分区 / 设置内聚合 | 独立专业 console 区 |
| DP-8 | 一级导航复杂度原则 | ≤5 / ≤7 / 9 全保留 / 其它 | 建议控制复杂度（≤7，多入口归 contextual/admin） |

> 每个 DP 均为 `PRODUCT_DECISION_REQUIRED`；本提案只给候选与初步建议，**最终由 Owner 决策**。

## 7. Deferrals（本提案不锁定）

- Product/Order primary-nav / contextual-role：**DEFER 到 Phase 4 M4.3**（domain importance 已 CONFIRMED；UX 决策未做）。
- 多店铺导航模型（全部店铺 / PDD / DouDian 等）：**SHEEP-041**。
- Design System（tokens / typography / spacing / color / components）：**M3.2（SHEEP-043~047）**。
- SHEEP-031 AI Panel：unmounted structural primitive；**不宣称 workspace integration**；挂载/集成留后续单元。
- FastWork reference 具体 workflow/IA 细节：仅 inspiration；不作为最终 spec。

## 8. 证据等级与性质

- CONFIRMED：Roadmap candidate domains；产品方向（Owner 决策）；SHEEP-031 = unmounted primitive。
- INFERRED：本提案对模型/入口的推导（低风险、可逆、仅文档）。
- PRODUCT_DECISION_REQUIRED：DP-1~DP-8。
- DEFERRED：§7 所列。
- 本提案**不改变任何产品代码/导航/路由**；reference-derived = NO（Fast Sheep 独立 IA 设计）。

## 9. 边界

- 未修改产品代码；未挂载 AI primitive；未实现路由；未提前实现 Phase 4。
- 未使用 FastWork reference 作视觉/几何/IA spec；未复制/未 eval/未联网/未 discovery/未读 nixiang。
- schema v7 不变；无 sync/Outbox。