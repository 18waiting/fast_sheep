# Fast Sheep Typography / Spacing / Color（SHEEP-044）

> 项目：Fast Sheep / 快羊客服 · Phase 3 / M3.2 · 日期：2026-08-27
> 定位：在 SHEEP-043 token 架构上精化 Typography / Spacing / Color（首次真正改变视觉）；**NO_TOPOLOGY_CHANGE**（不改 DOM/selector/区域排列/sidebar 宽度）。
> FastWork reference 仅作 workflow/IA inspiration；**不使用其视觉值，不 pixel-match**。

## 1. Visual Character（DP-34）

- **CALM_PROFESSIONAL_AI_NATIVE_CLARITY**：沉稳专业、现代生产力工具、默认安静，语义需要时才强调。
- 禁止 AI neon/glow/gradient skin；不做消费级玩具化视觉。

## 2. Typography（DP-29：COMPACT_OPERATIONAL_TYPE_SCALE_WITH_CLEAR_HIERARCHY）

- 定义 **operational typography hierarchy**：font-size + line-height + weight role。
- 新增（值在既有 baseline 上定义，无新字体）：
  - line-height：`--fs-line-height-tight`(1.25) / `--fs-line-height-normal`(1.5)
  - weight role：`--fs-font-weight-normal`(400) / `medium`(500) / `semibold`(600)
- 字体栈保持 **system UI**（`--fs-font-sans`），无远程/专有字体。
- 层级最小，不扩张为营销网站式大字阶（font-size 维持 xs~lg）。

## 3. Spacing（DP-30：4PX_BASE_RHYTHM_WITH_USAGE_DRIVEN_EXCEPTIONS）

- 审计：`--fs-space-5 = 10px` 为**用法驱动例外**（worker-badge/mode-btn 等水平 padding 用 10px），保留为 compatibility；不因数学整齐改变布局。
- 4px base rhythm 保持；未新增 spacing token。

## 4. Color（DP-31：CONTROLLED_FULL_SEMANTIC_PALETTE_REFINEMENT）

- 受控复核 canvas/surface/text/border/action/status/fact/assistance/evidence semantic roles；
- **未扩张新视觉宇宙、未新增业务色**；当前色值保持（calm 专业 baseline，DP-34）。
- canonical status 保持 `neutral/info/success/warning/danger`；`primary` 归 Action/Accent。
- Fact/Assistance/Evidence 当前 mapping 仍为 **provisional mechanical baseline**（最终由视觉评审迭代，SHEEP-044 不锁定最终值）。

## 5. Fact / Assistance / Evidence 区分（DP-32：DISTINCT_BUT_SUBORDINATE_ASSISTANCE_WITH_MULTI_CUE_SEMANTICS）

- color 仅作 **reinforcement**，非唯一语义载体（multi-cue：color + weight + 标签/位置）。
- AI Assistance 可辨认但**不压过**事实、客户内容或危险状态（calm、低饱和、subordinate）。
- Action/Info/Assistance/Link 共享色系时靠 weight/语义多线索保持可区分。

## 6. NO_TOPOLOGY_CHANGE（DP-33）

- styles.css 仅消费 typography 值（body line-height、`font-weight:600` → `var(--fs-font-weight-semibold)` ×4）；
- **未改变 DOM、selector 结构、区域排列、sidebar 宽度等页面几何/功能布局**。

## 7. 视觉证据

- `reports/visual-evidence/sheep-044-workbench.png`：真实 renderer 工作台截图（stub Main + 真实 preload/renderer，合成测试数据）。
- 供 **Owner 人工设计评审**；不作 FastWork pixel-match，不建立脆弱 pixel regression。

## 8. 边界

- 未使用 FastWork visual values；无远程/专有字体；无 dark theme；无 density switcher；无 AI skin。
- 未挂载 AI primitive；未实现 Phase 4；schema v7 不变；无 sync/Outbox。
- **最终视觉批准 = Owner visual review**（Controller COMPLETE 不单独代表 DP-29~34 视觉批准）。