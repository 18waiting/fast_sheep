# Sidebar Reference Evidence（SHEEP-027）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.2 · 日期：2026-08-26
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；未复制/未修改/未 eval）

## 1. Reference evidence（CONFIRMED / UNKNOWN）

- **CONFIRMED**（SHEEP-022）：reference sidebar.js = shell（左侧店铺列表侧栏）；职责含
  店铺卡片渲染/切换、添加店铺模态框、删除；店铺数据经 `店铺API` 与主进程通信（L13）。
- **CONFIRMED**（SHEEP-023）：sidebar.js = UI_WITH_BRIDGE + BACKEND_DEPENDENT +
  AUTH_OR_SELLER_DEPENDENT（login/api_key/token 标记）；**direct bridge/API portability = NOT_ESTABLISHED**。
- **UNKNOWN / NOT_EVIDENCED**：reference 卡片精确布局、尺寸、间距、视觉值
  （当前授权 scope 无可观察独立 CSS/截图；未 eval、未提取嵌入资产）。

## 2. Fast Sheep clean-room Sidebar（独立实现，非 reference 复制）

- `apps/desktop/src/renderer/components/shop-sidebar.ts`：店铺列表 + 选中态（`aria-current`），
  数据仅来自 typed `viewModel.shop_summaries`（shop_id/name/type/enabled）。
- **selection semantics = 现有 clean-room 行为**：仅 `onSelectShop(shop_id)` 选择；未新增
  route/navigation、自动数据加载、bridge call、current-shop persistence、recent/default shop、
  seller-session 切换逻辑。
- **未重新解释 `enabled/type` 业务含义**：现有展示行为保持；未新增 disabled/auth/entitlement/
  platform-availability 语义。
- **provenance**：independently implemented clean-room；`reference_match_status = NOT_ESTABLISHED`。
- **空状态文案**：沿用现有 clean-room baseline（`暂无店铺 (平台适配器将于 M7/M8 接入)`）；
  `reference-derived = NO`，不作为 FastWork reference evidence。

## 3. DO_NOT_PORT_DIRECTLY（feature 粒度）

- 添加店铺模态框 / 删除店铺：依赖 backend/platform（`店铺API`）→ **不直接 port**；
  留给 SHEEP-029 Dialog/Common 或对应 Fast Sheep 平台单元。
- 店铺数据获取 / 增删操作：按 Fast Sheep Main / 平台架构重实现。

## 4. 结构调整记录

- `app-sidebar` 区域（SHEEP-026 建立）现直接承载 shop-sidebar 内容；原 `sidebar-host`
  中间层经核实为**纯冗余**（无 CSS 规则、无测试/脚本引用、无状态生命周期依赖）后移除。
- 未为此引入任何新 shell framework/contract；选择器/布局/状态生命周期不变。

## 5. 边界

- 未复制 reference bundle 代码 / 嵌入样式 / token 值；未 eval；未联网；未扩大 scope。
- 无远程 font/icon/image；CSP 保持（`style-src 'self'`、`connect-src 'none'`）；
  `external_network_calls = 0`。
- schema v7 / migrations 不变；无 sync/Outbox；无 Phase 3 redesign。