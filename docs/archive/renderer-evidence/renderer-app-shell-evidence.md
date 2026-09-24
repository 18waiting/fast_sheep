# App Shell Reference Evidence（SHEEP-026）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.2 · 日期：2026-08-25
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；未复制/未修改/未 eval）

## 1. Reference IA（证据来自 SHEEP-021~023，CONFIRMED / INFERRED）

- **CONFIRMED**：reference 存在 **navbar shell（顶部导航条）** 与 **sidebar shell（左侧店铺侧栏）**
  （SHEEP-022：navbar.js L4「左侧栏导航条交互逻辑」、sidebar.js L4「左侧栏交互逻辑」）。
- **CONFIRMED**：reference App Shell 由 顶部导航区 + 左侧栏区 + 主内容区 构成（shell 区域关系）。
- **INFERRED**：顶部/左侧的相对位置关系（由「导航条」「左侧栏」语义推断，低风险、可逆）。
- **UNKNOWN / NOT_EVIDENCED**：navbar 高度、sidebar 宽度、padding/gap、sticky/fixed、breakpoint、
  精确尺寸与视觉值（当前授权 scope 无可观察独立 CSS/截图；未 eval、未提取嵌入资产）。

## 2. Fast Sheep clean-room shell（独立实现，非 reference 复制）

- `apps/desktop/src/renderer/components/app-shell.ts` 建立三区骨架：
  - `app-navbar`（`<nav>`，顶部区域容器，**空占位**，SHEEP-028 填充）
  - `app-sidebar`（左区域容器，内部继续渲染既有 shop-sidebar，SHEEP-027 精化）
  - `app-main`（主工作区，既有全部功能区域保持可用：error/header/status/countdown/panels/
    platform/m10/m11）
- **provenance**：independently implemented clean-room；`reference_match_status = NOT_ESTABLISHED`；
  `reference-derived = NO`（未复制 reference 代码/嵌入样式/token 值）。
- 集成点保持最小：仅清晰容器边界；**未引入** slot registry / dynamic mount / navigation API /
  其它 shell framework contract。

## 3. Region map（reference_role × restoration_disposition）

| Fast Sheep region | reference role | restoration disposition | 说明 |
|---|---|---|---|
| `app-navbar` | shell（导航条） | SHELL（SHEEP-028 填充） | 空容器占位；几何参数 UNKNOWN，未发明数值 |
| `app-sidebar` | shell（店铺侧栏） | SHELL（SHEEP-027 精化） | 既有 shop-sidebar 继续渲染；不提前实现其内部 |
| `app-main` | 主工作区 | 既有 clean-room workbench | 现有功能区域全部保持可用 |

## 4. 边界

- 未复制 reference bundle 代码 / 嵌入样式 / token 值；未 eval；未联网；未扩大 scope。
- 仅复用现有 clean-room tokens/值（`--fs-*`；既有 220px 侧栏宽来自 M6 baseline，非新发明）。
- 无远程 font/icon/image；CSP 保持（`style-src 'self'`、`connect-src 'none'`）；
  `external_network_calls = 0`。
- schema v7 / migrations 不变；无 sync/Outbox；无 Phase 3 redesign。