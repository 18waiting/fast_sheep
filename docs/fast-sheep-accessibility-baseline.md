# Fast Sheep Accessibility Baseline（SHEEP-047）

> 项目：Fast Sheep / 快羊客服 · Phase 3 / M3.2 · 日期：2026-08-27
> 定位：Accessibility Baseline（heading/focus/contrast/ARIA/reduced-motion/modal-focus contract）；NO_TOPOLOGY_CHANGE。
> 依据：DP-49~56（Owner 收紧决策）、DP-22~48、SHEEP-043~046。
> FastWork reference 仅作 workflow/IA inspiration；非视觉/几何 spec，不 pixel-match。

## 1. 决策落地（DP-49~56）

| DP | 决策 | 落地 |
|---|---|---|
| DP-49 | HEADING_LEVEL_FOLLOWS_DOCUMENT_STRUCTURE_NOT_VISUAL_TEXT_ROLE | 审计真实页面结构：shop-sidebar h2「店铺」、conversation/suggestion/platform h3——合理 native heading hierarchy；不强制每页 h1、不全用 div；visual text roles 不永久锁 h1/h2/h3 |
| DP-50 | NATIVE_TAB_ORDER_VISIBLE_FOCUS_NO_KEYBOARD_TRAPS | 全部真实交互为 native button（键盘可达）；无 positive tabindex；focus-visible 覆盖 .fs-action/.btn/.shop-button/.mode-btn（primary outline 5.19:1）；不重复实现 native Enter/Space |
| DP-51 | WCAG_AA_CONTRAST_BASELINE | mechanical contrast audit：正文/大文本 4.5:1、UI boundary/focus 3:1；**修正** muted #8c959f→#65717c（4.99/4.69）、border #d8dee4→#87919e（3.19/3.00）、focus outline→primary、selected border→primary；status 色全部 ≥4.5（未改） |
| DP-52 | NATIVE_SEMANTICS_FIRST_MINIMAL_ARIA | native HTML 优先；ARIA 仅补 native 无法表达（alert/status/dialog/nav）；无 role=button on div、无 ARIA spam、aria-label 不掩盖可见文字 |
| DP-53 | PREFERS_REDUCED_MOTION_IS_A_DESIGN_SYSTEM_REQUIREMENT | 当前无 motion（不强制 selector）；contract 确定——未来非必要 motion 必须尊重 prefers-reduced-motion |
| DP-54 | MODAL_FOCUS_CONTRACT_REQUIRED_IMPLEMENTATION_AT_FIRST_REAL_CONSUMER | modal initial focus / contained tab / Escape（除非业务禁止）/ return focus = accessibility contract；dialog 无 production consumer，不提前造 focus framework；overlay-click-close 继续 product-specific/DEFER；不再以 FastWork reference evidence 为前提 |
| DP-55 | SEMANTIC_EVENT_ANNOUNCEMENTS_NOT_RAW_UPDATE_STREAMS | error/重要失败=assertive（role=alert）；loading/refresh=polite（role=status）；未来 AI streaming/countdown 只在有意义 semantic event 上 announcement |
| DP-56 | FOCUS_SELECTION_AND_STATUS_ARE_VISUALLY_DISTINCT | focus=outline ring（primary）；selected=fill+border（primary border on bg-selected）；status=color+text——三种信号可区分 |

## 2. 审计结果（DP-51 mechanical contrast audit）

| 组合 | 修正前 | 修正后 | 目标 |
|---|---|---|---|
| text on surface | 15.80 | 15.80 | 4.5 ✅ |
| text-secondary on surface | 6.39 | 6.39 | 4.5 ✅ |
| **text-muted on surface / bg** | 3.04 / 2.85 | **4.99 / 4.69** | 4.5 ✅ |
| text-on-primary on primary | 5.19 | 5.19 | 4.5 ✅ |
| status success/warning/danger/info on surface | 5.08 / 6.45 / 5.36 / 5.19 | 不变 | 4.5 ✅ |
| **border on surface / bg** | 1.36 / 1.28 | **3.19 / 3.00** | 3:1 ✅ |
| focus outline (primary) on surface / bg-selected | — | 5.19 / 4.56 | 3:1 ✅ |

> 视觉变化（a11y 驱动，最小 semantic-token 修正）：muted 文字略深、border 略深、selected border 用 primary。已记录。

## 3. 新增/修正（renderer）

- tokens.css：`--fs-prim-ink-400` #8c959f→#65717c；`--fs-prim-border` #d8dee4→#87919e（a11y 驱动）。
- styles.css：focus-visible（primary outline）覆盖 .fs-action/.btn/.shop-button/.mode-btn；`.shop-button.selected` border→primary；loading/error 语义 role 保持。

## 4. A11y / Focus Gallery（evidence-only）

- `reports/visual-evidence/a11y-focus-gallery.html`：展示 focus-visible（primary autofocus）、selected vs focus vs status 区分、loading/error 语义 announcement。
- 不进入 production navigation/runtime。

## 5. 自动化 guard（DP-14，辅助证据，非 scanner）

- `renderer-a11y-baseline.test.ts`：contrast AA 机械审计（token 组合计算）；无 positive tabindex；focus-visible 规则存在；native heading 使用；无 role=button on div/重复 aria-label/assertive spam；focus/selected/status 视觉信号区分；gallery evidence-only。

## 6. 边界

- NO_TOPOLOGY_CHANGE；a11y 属性/heading/focus/必要 contrast token 最小调整；未重做页面/Conversation IA/Store navigation/AI placement。
- 未引入大型 scanner 依赖；自动扫描仅辅助证据。
- 未挂载 AI primitive；未实现 Phase 4；schema v7 不变；无 sync/Outbox。