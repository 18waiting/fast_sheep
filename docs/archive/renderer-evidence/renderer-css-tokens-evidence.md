# Global CSS / Tokens Reference Evidence（SHEEP-025）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.2 · 日期：2026-08-25

## 1. Reference evidence（CONFIRMED / UNKNOWN）

- **CONFIRMED**：reference renderer 树**无独立 CSS 文件**（SHEEP-021 清点：仅 5 个 JS）。
- **CONFIRMED**：5 个 bundle 含 DOM/style 相关证据（SHEEP-023：DOM/UI 标记存在）。
- **UNKNOWN / NOT_EVIDENCED**：bundle 内嵌的全局 CSS / token 系统具体内容与 token 值
  （当前授权 scope 无可观察独立 CSS/截图；未 eval、未提取嵌入资产）。
- **结论**：**不得声称已确认完整 FastWork global CSS/token system**；reference token values
  保持 UNKNOWN / NOT_EVIDENCED。

## 2. Fast Sheep 侧（独立重实现，非 reference 复制）

- `apps/desktop/src/renderer/tokens.css`：Fast Sheep 设计 tokens（CSS 自定义属性，`--fs-*` 中性命名）。
- 值**机械提升**自 Fast Sheep clean-room `styles.css` baseline（逐一同原值；无视觉 redesign）。
- **provenance**：independently implemented clean-room baseline；
  `reference_match_status = NOT_ESTABLISHED`（非取自 FastWork reference）。
- `styles.css`：重构为消费 tokens；选择器/布局/DOM 不变（37 个 var() 全部解析，0 未定义）。
- `index.html`：`<title>` 由 `FastWork 工作台 (M6)` → `快羊客服` —— 见报告 §identity-cleanup。

## 3. 边界

- 无远程 font/icon/image；无 proprietary assets；CSP 保持（`style-src 'self'`）。
- 无 Phase 3 Design System / redesign；无其它页面实现（SHEEP-026+）。