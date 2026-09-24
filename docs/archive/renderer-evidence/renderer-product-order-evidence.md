# Product / Order Context Reference Evidence（SHEEP-034）

> **历史证据快照（非当前 gap 状态）**：下文 `OPEN / NOT_EVIDENCED` 记录 SHEEP-034 当时对独立页面证据的结论，局部商品/订单证据仍予保留。其后 Owner 在 [REFERENCE_GAP_RESOLUTION_CHECKPOINT](reference-gap-resolution-checkpoint.md) 将 G4 处置为 `DEFER`（当时指向 Phase 4 M4.3），而非授权扩大 reference discovery 或认定完全无证据。当前产品方向与执行授权分别以 [North Star](product/FAST_SHEEP_NORTH_STAR.md) 和 [PROJECT_STATE.json](../project/PROJECT_STATE.json) 为准。

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.3 · 日期：2026-08-26
> 定位：**Product/Order Context Clean-room Baseline Consolidation + Reference Evidence Gap Record**
> （**不得**宣称完成 Track-A Product/Order Context restoration）
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；Owner-authorized re-verification；未复制/未修改/未 eval/未联网）

## 1. 逐项核验：Target page evidence vs partial/local UI evidence（严格区分）

### Product（商品）

| 类别 | 结论 | 说明 / non_evidence_reason |
|---|---|---|
| **独立 Product Context page/layout** | **NOT FOUND / UNKNOWN / NOT_EVIDENCED_IN_CURRENT_AUTHORIZED_SCOPE** | 5-bundle 无独立商品页/面板；「商品库」页由 Main 侧导航（`window.店铺API.跳转商品库搜索`） |
| **partial/local UI evidence** | **CONFIRMED**（保留为 Phase 4 M4.3 可参考 evidence） | sidebar.js 买家气泡详情浮层「商品信息」块（L2296/L2349）；knowledge.js 商品ID 紫色筛选维度（L67-75）——**局部 UI evidence，不能证明 SHEEP-034 Track-A restoration** |
| 商品字符串（ai.js×66 / knowledge.js×113 / sidebar.js×116） | CONFIRMED（内容/数据字符串） | 聊天/知识内容引用，非布局证据 |

### Order（订单）

| 类别 | 结论 | 说明 / non_evidence_reason |
|---|---|---|
| **独立 Order Context page/layout** | **NOT FOUND / UNKNOWN / NOT_EVIDENCED_IN_CURRENT_AUTHORIZED_SCOPE** | 5-bundle 无独立订单页/面板 |
| **partial/local UI evidence** | **CONFIRMED**（保留为 Phase 4 M4.3 可参考 evidence） | sidebar.js 买家气泡详情浮层「订单信息」块 + 订单号复制（L2296/L2376/L2409 `coop-detail-block`）——**局部 UI evidence，不能证明 SHEEP-034 Track-A restoration** |
| 订单字符串（ai.js×1 / sidebar.js×58） | CONFIRMED（数据/字符串标记） | 数据/字符串引用，非布局证据 |

> **不得笼统写成「完全无 Product/Order UI evidence」**：独立页面/布局 = NOT_EVIDENCED；局部 UI evidence = CONFIRMED，并保留为未来 Phase 4 M4.3 参考。

## 2. REFERENCE_GAP（正式记录）

```
ID: REFERENCE_GAP-PRODUCT-ORDER-CONTEXT
status: OPEN / NOT_EVIDENCED_IN_CURRENT_AUTHORIZED_SCOPE
sub_findings:
  - PRODUCT: 独立商品 Context 页面/布局 NOT_EVIDENCED（局部 UI evidence CONFIRMED，保留给 M4.3）
  - ORDER:   独立订单 Context 页面/布局 NOT_EVIDENCED（局部 UI evidence CONFIRMED，保留给 M4.3）
consequence: Track-A Product/Order Context reference restoration 当前无法宣称
resolution: 需 Owner 单独授权 reference discovery，或明确选择 clean-room / non-reference 路线（未自动决定）
```

## 3. Fast Sheep clean-room baseline（现状）

- renderer 现**无** Product/Order Context UI。
- 记录：`clean_room_ui_baseline = NOT_IMPLEMENTED`、`layout_status = NOT_IMPLEMENTED`、
  `reference_match_status = NOT_ESTABLISHED`、`reference-derived = NO`。
- Product/Order Context 实际 UI 属 **Phase 4 M4.3**（Roadmap 定位）；本单元不提前实现。
- **SHEEP-034 产品代码变更 = 0；新增测试 = 0。**

## 4. 只读治理观察（只报告趋势；不改 Roadmap / 不创建 checkpoint）

- gap-cluster 扩展：Conversation（SHEEP-030）+ PDD（SHEEP-032）+ DouDian（SHEEP-033）+
  **Product/Order Context（SHEEP-034）**。
- **SHEEP-034 本身不创建 checkpoint、不改 Roadmap。**
- 若 **SHEEP-035 核验后同样形成 gap**，则建议由 Owner 在 **M2.3 evidence coverage 完整后**考虑
  Reference Gap Resolution Checkpoint。
- 是否创建 checkpoint / 是否扩大 reference scope：**由 Owner 单独决定**。

## 5. 边界

- 未扩大 reference scope；未读其它 FastWork tree / `E:\nixiang` / `rebuild`。
- 未复制 reference 内容；未 eval；未联网。
- CSP 保持；`external_network_calls = 0`；schema v7 不变；无 sync/Outbox。