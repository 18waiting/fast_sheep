# Header / Navigation Reference Evidence（SHEEP-028）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.2 · 日期：2026-08-26
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；未复制/未修改/未 eval）

## 1. Reference evidence（CONFIRMED / UNKNOWN）

- **CONFIRMED**（SHEEP-022）：reference navbar.js = shell（导航条）；职责=导航项渲染/点击切换 +
  右上用户信息（用户名/对话数/积分/到期时间）；数据来源（主进程/店铺API）未验证。
- **CONFIRMED**（SHEEP-023）：navbar.js = UI_WITH_BRIDGE + BACKEND_DEPENDENT
  （从主进程获取导航项/监听推送）；**direct bridge/API portability = NOT_ESTABLISHED**。
- **UNKNOWN / NOT_EVIDENCED**：导航项具体标签/顺序、用户信息字段、navbar 高度/padding/gap/
  sticky/breakpoint、精确视觉值（无独立 CSS/截图；未 eval、未提取嵌入资产）。

## 2. Fast Sheep clean-room Header/Navigation（独立实现，非 reference 复制）

- `apps/desktop/src/renderer/components/app-navbar.ts`：填充 `nav.app-navbar` 为两个**空结构子区域**：
  - `app-navbar-nav`（主导航区，空占位）
  - `app-navbar-user`（用户信息区，空占位）
- 子区域的具体左右排列 / flex 对齐方式 = **Fast Sheep clean-room implementation decision**：
  `reference-derived = NO / INFERRED`；`reference_match_status = NOT_ESTABLISHED`。
- aria-label 仅使用通用无障碍标签（`主导航区` / `用户信息区`），**未提前确定** Phase 3 导航产品文案、
  栏目名或用户信息字段。
- 空 navbar 为**真正结构占位**：无 avatar/用户名/badge/logo/icon/loading/skeleton/“暂无导航”等
  占位业务/视觉 UI。
- 现有 `workbench-header`（Fast Sheep clean-room，位于 app-main 内）**不属于 reference navbar**，
  本任务未改动、未移动。

## 3. DEFERRED（不扩大 scope）

- Fast Sheep 导航分类体系（栏目名/顺序）：Phase 3 SHEEP-040/041 IA（Roadmap 定位，非 M2.2）。
- 用户信息数据契约（username/points/expiry 等）：typed IPC 现无对应数据；后置到对应数据/UI 单元。
- navbar 几何/视觉参数：保持 UNKNOWN/NOT_EVIDENCED。

## 4. 边界

- 未复制 reference bundle 代码 / 嵌入样式 / token 值；未 eval；未联网；未扩大 scope。
- 无远程 font/icon/image；CSP 保持（`style-src 'self'`、`connect-src 'none'`）；
  `external_network_calls = 0`。
- schema v7 / migrations 不变；无 sync/Outbox；无 Phase 3 redesign。