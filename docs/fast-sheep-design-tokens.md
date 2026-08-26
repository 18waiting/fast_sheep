# Fast Sheep Design Tokens（SHEEP-043）

> 项目：Fast Sheep / 快羊客服 · Phase 3 / M3.2 · 日期：2026-08-27
> 定位：Design Token 系统基础（token architecture + semantic inventory + 初始值）
> 依据：DP-22~28（Owner 决策）、SHEEP-025 clean-room baseline、产品方向（AI-native + Professional fallback）
> FastWork reference 仅作 workflow/IA inspiration；**不使用其视觉值，不 pixel-match**。

## 1. Token 层级（tightening #10）

```
primitive → semantic → optional context/density → component
```

- **primitive**：原始值（`--fs-prim-*`），仅包含 renderer 当前真实需要的值（DP-22 最小化）。
- **semantic**：角色化语义（`--fs-color-*` / `--fs-space-*` / `--fs-radius-*` / `--fs-border-*` / `--fs-font-*`），全部引用 primitive，无裸值。
- **optional context/density**：**保留层，不实现**（DP-28；无 density switcher）。
- **component**：组件消费 semantic tokens（styles.css 现有消费，0 undefined）。

## 2. 决策落地（DP-22~28）

| DP | 决策 | 落地 |
|---|---|---|
| DP-22 | PRIMITIVE_PLUS_SEMANTIC | 双层；primitive 仅当前真实值 |
| DP-23 | SHARED_SEMANTIC_SYSTEM_WITH_CONTEXTUAL_DENSITY_CAPABILITY | 单一共享语义；无两套 Agent/Professional 视觉主题 |
| DP-24 | `--fs-*` namespace 保留 + alias 过渡 | 现有 token 名全部保留，语义化重组 |
| DP-25 | LIGHT_FIRST_THEME_READY_DARK_DEFERRED | 仅 light；无 dark palette/selector/persistence |
| DP-26 | 无 AI 品牌色/AI 皮肤 | 定义可复用 semantic roles：Fact / Assistance / Evidence / Status / Action；AI 为消费者 |
| DP-27 | LIMITED_SEMANTIC_STATUS_PALETTE | 状态仅映射有限 status roles（success/warning/danger/error/warning-strong/primary + bg 变体） |
| DP-28 | DENSITY_IS_CONTEXTUAL_CAPABILITY_NOT_THEME | density 为未来 contextual capability；当前不实现 |

## 3. Semantic roles（DP-26）

- **Fact**：原始事实（`--fs-color-fact` / `--fs-color-fact-secondary`）——raw facts 始终可核验（I-1/I-4）。
- **Assistance**：AI 建议（`--fs-color-assistance` / `--fs-color-assistance-bg`）——附着工作对象（DP-18）；无专属 AI 品牌色。
- **Evidence**：依据/来源（`--fs-color-evidence` / `--fs-color-evidence-bg`）——AI 建议可查看支撑事实（I-4）。
- **Status**：有限状态色（DP-27）。
- **Action**：交互动作（`--fs-color-action`）。

> Fact 与 AI suggestion 在视觉语义上可区分（fact=正文色 / assistance=action 色 / evidence=次级色），但不依赖专属炫彩 AI skin。

## 4. 迁移与验收

- `--fs-*` namespace 保留；无一次性大迁移；旧 token 全部保留为 alias（DP-24/收紧 #9）。
- 验收：**styles.css 37 个 var() 全部解析（0 undefined / 0 cycle）**；selector/DOM/behavior 不变；视觉 baseline 机械等价（SHEEP-025 值原样提升为 primitive）。

## 5. 边界

- 未改变 selector/layout/DOM/功能行为；未挂载 AI primitive；未实现 Phase 4；未锁最终视觉（typography/spacing/color 精化 = SHEEP-044）。
- 未使用 FastWork reference 视觉值；未复制/未 eval/未联网/未 discovery/未读 nixiang。
- schema v7 不变；无 sync/Outbox。