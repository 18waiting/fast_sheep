# AI Panel Reference Evidence（SHEEP-031）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.3 · 日期：2026-08-26
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；仅 ai.js 已授权 evidence；未复制/未修改/未 eval）

## 1. Reference evidence（CONFIRMED / UNKNOWN / INFERRED）

- **CONFIRMED**（SHEEP-022，ai.js）：AI Panel 中存在 **功能列表区（左栏）**、**聊天区（右栏）**、
  **欢迎页/预设问题区** 三区域结构（L9/L16）。
- **CONFIRMED**（SHEEP-021/023）：发消息/流式/管家API/子进程 = **DO_NOT_PORT_DIRECTLY**；
  ai.js = UI_WITH_BRIDGE + BACKEND_DEPENDENT + NETWORK_DEPENDENT + **AUTH_OR_SELLER_DEPENDENT**
  （token/session/cookie/login×14）；**direct bridge/API portability = NOT_ESTABLISHED**。
- **UNKNOWN / NOT_EVIDENCED**：功能列表具体条目/顺序、预设问题卡片内容/数量、聊天区精确尺寸/
  间距/视觉值、三者精确 DOM hierarchy。
- **INFERRED（provisional clean-room decision）**：`ai-welcome` 嵌套于 `ai-chat` 内
  （欢迎/预设问题区为聊天区初始态）；`reference-derived = NO / INFERRED`，**不升级为 CONFIRMED**。

## 2. Fast Sheep clean-room AI Panel（独立实现，非 reference 复制）

- `apps/desktop/src/renderer/components/ai-panel.ts`：`renderAiPanel(root)` 构建
  `ai-panel` → `ai-tools`（功能列表区，空）+ `ai-chat`（聊天区，空，内含 `ai-welcome` 欢迎/预设问题区，空）。
- **无** preset-card API / 点击行为 / composer 填充 / 发送语义；卡片内容与交互 UNKNOWN。
- **`ai-tools` 仅为 AI Panel feature-list UI region 命名**，不等同于 Phase 8 Tool/Capability/
  Permission domain；无授权/工具领域语义。
- **未挂载**：组件独立存在，未接入现有 workbench；`runtime integration / placement /
  API stability = NOT_ESTABLISHED`。
- `reference_match_status = NOT_ESTABLISHED`；`layout_stability = PROVISIONAL`。
- **styles.css 未改**（无精确几何/视觉 evidence，未新增任何 CSS）。

## 3. DEFERRED（不扩大 scope）

- 实际 AI 功能 / 发送 / 流式 / 模型集成：Phase 4 M4.x / AI Worker / Phase 9 Knowledge。
- AI Panel 挂载与放置：Phase 3 IA 或首个消费者决定。
- 功能列表条目 / 预设问题卡片内容：UNKNOWN，待对应证据/单元。

## 4. 边界

- 未复制 reference bundle 代码 / 嵌入样式 / token 值；未 eval；未联网；未扩大 scope。
- 无远程 font/icon/image；CSP 保持（`style-src 'self'`、`connect-src 'none'`）；
  `external_network_calls = 0`。
- schema v7 / migrations 不变；无 sync/Outbox；无 Phase 3 redesign。
- **M6 smoke 仅作 non-regression evidence，不据此宣称 AI Panel runtime restoration 完成。**