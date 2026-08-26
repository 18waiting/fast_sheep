# Fast Sheep Component Primitives（SHEEP-045）

> 项目：Fast Sheep / 快羊客服 · Phase 3 / M3.2 · 日期：2026-08-27
> 定位：thin DOM helper + semantic class contract（**无 component framework**）；**NO_TOPOLOGY_CHANGE**；Conversation 中心化 / AI attachment / Store navigation / Background Tasks IA 均不在本单元。
> 依据：DP-35~40（Owner 收紧决策）、DP-22~34、SHEEP-043/044。
> FastWork reference 仅作 workflow/IA inspiration；非视觉/几何 spec，不 pixel-match。

## 1. 决策落地（DP-35~40）

| DP | 决策 | 落地 |
|---|---|---|
| DP-35 | ACTION_PROMINENCE_AND_INTENT_ARE_ORTHOGONAL | prominence = primary/secondary/quiet（最小）；intent = default/destructive（独立轴，destructive ≠ status-danger、不与 prominence 平级）；interaction state（default/hover/focus/pressed/disabled）在 CSS 层，与业务/status 语义分离；无 button-success/button-warning 业务状态按钮体系 |
| DP-36 | MINIMAL_SEMANTIC_PRIMITIVE_SET | 仅 action/text/status/badge；未因重复矩形建 Panel/Card/Surface（现有 clean-room surface 类已满足语义需求）；badge 展示与 status 语义分离（无万能 StatusBadge） |
| DP-37 | SEMANTIC_TEXT_ROLES_NOT_NUMERIC_HEADING_LEVELS | text roles = work-object-title / section-title / component-title / body / label / metadata；不锁 HTML heading level（h1-h6 映射留 SHEEP-047） |
| DP-38 | THIN_REUSABLE_PRIMITIVES_NO_COMPONENT_FRAMEWORK | 仅薄 DOM helper + class contract；无 slot registry / state manager / theme provider / variant engine / 自建 framework |
| DP-39 | EVIDENCE_DRIVEN_PRIMITIVES_WITH_REAL_CONSUMER_VALIDATION | 每个 primitive 有明确消费者声明（见 §Consumers）；未创建零消费者 dead primitive；未强行重构现有组件（生产代码零迁移——primitives 增量，行为/事件/DOM 语义不变） |
| DP-40 | NATIVE_SEMANTICS_FIRST | 真实 action 保持原生 `<button>`；无 div-role-button；不混淆 link/action；完整 Accessibility 留 SHEEP-047，本单元不制造语义债务 |

## 2. Primitives 清单（thin helpers）

- `components/primitives/action.ts`：`actionButton({ label, prominence, intent, disabled, onClick })` → 原生 `<button class="fs-action fs-action--primary|secondary|quiet [fs-action--destructive]">`
- `components/primitives/text.ts`：`textRole(role, text, tag?)` → `<div|span class="fs-text fs-text--<role>">`（不锁 heading level）
- `components/primitives/status.ts`：`statusMarker(role, text)` → `<span class="fs-status fs-status--neutral|info|success|warning|danger">`；`badge(text, extra?)` → `<span class="fs-badge">`

## 3. Consumers（DP-39：真实/明确近期消费者声明）

- `actionButton`：近端消费者 = SHEEP-046 Empty/Error/Loading actions、SHEEP-048 App Shell 操作行；Primitive Gallery 展示（evidence-only）。
- `textRole`：近端消费者 = SHEEP-046 状态文案、SHEEP-048 标题体系；Gallery 展示。
- `statusMarker` / `badge`：近端消费者 = SHEEP-046 状态展示、SHEEP-048 状态徽标；Gallery 展示。
- **生产迁移 = 0**：现有组件保持原类/行为；primitives 为增量，未来 consumer 接入时按证据迁移（DOM/行为/事件语义保持不变）。

## 4. Primitive Gallery（evidence-only）

- `reports/visual-evidence/primitive-gallery.html`：展示 text/action/status/badge primitives。
- **不进入 production navigation/runtime**（不引用 renderer main.js/app-shell）。

## 5. 边界

- NO_TOPOLOGY_CHANGE：DOM/selector 结构/区域排列/sidebar 宽度未变。
- 无 FastWork visual values；无远程字体；无 dark theme；无 density switcher；无 AI skin。
- canonical status 词表未扩张；未新增业务色；未挂载 AI primitive；未实现 Phase 4；schema v7 不变；无 sync/Outbox。