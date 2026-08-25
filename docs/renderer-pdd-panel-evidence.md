# PDD Panel Reference Evidence（SHEEP-032）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.3 · 日期：2026-08-26
> 定位：**PDD Panel Clean-room Baseline Consolidation + Reference Evidence Gap Record**
> （**不得**宣称完成 Track-A PDD Panel restoration）
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；未复制/未修改/未 eval）

## 1. PDD Panel DOM/UI evidence（先证明）

- **结论（统一表述）**：PDD Panel DOM/UI layout evidence =
  **NOT FOUND / UNKNOWN / NOT_EVIDENCED_IN_CURRENT_AUTHORIZED_SCOPE**。
  （仅证明 authorized 5-bundle scope 未发现布局证据；**不是**全局意义“PDD Panel 不存在”。）
- **CONFIRMED**：SHEEP-022 page map ——「平台浏览器面板（PDD/DouDian）…当前 5 个 bundle 中未出现」。
- **CONFIRMED（URL reference only，非布局证据）**：account.js L275（×1）、ai.js L229-243（×4，
  平台登录/IM 门户）——仅确认 URL 字面量存在。
- **DO_NOT_PORT_DIRECTLY（非布局证据）**：login/password/token/session/cookie 标记（SHEEP-021/023）。

## 2. REFERENCE_GAP（正式记录）

```
ID: REFERENCE_GAP-PDD-PANEL
status: OPEN / NOT_EVIDENCED_IN_CURRENT_AUTHORIZED_SCOPE
finding: PDD platform browser panel UI/layout NOT FOUND in authorized 5-bundle scope
non_evidence: PDD URL literals / platform type strings / login & auth markers
    （均为 URL/network/auth reference，非 PDD Panel layout evidence）
consequence: Track-A PDD Panel reference restoration 当前无法宣称
resolution: 需 Owner 单独授权 reference discovery（新增读取范围），
    或明确选择 clean-room / non-reference 路线（未自动决定）
```

## 3. Fast Sheep clean-room 平台面板 baseline（provisional，未改动）

- `empty-platform-panel.ts`（M6：「平台接入」+「平台适配器尚未启用 (M7/M8 接入)」）。
- `platform-surface.ts`（M7：平台区域 + ResizeObserver bounds + 状态浮层；**从不读取 PDD DOM/会话**）。
- 均为 **provisional clean-room baseline**：`reference-derived = NO`、
  `reference_match_status = NOT_ESTABLISHED`、`layout_stability = PROVISIONAL`；
  **不构成 reference-validated 或永久 UI contract**。
- **SHEEP-032 产品代码变更 = 0**（未新增 PDD UI / 布局 / 视觉）。

## 4. M2.3 影响评估（只报告，不修改/跳过 Roadmap）

- **SHEEP-033（DouDian）可能受同类 evidence gap 影响**（5-bundle scope 无 DouDian 面板）。
- SHEEP-033 后续提案必须**先重新核验证据**；若证据与 SHEEP-032 完全相同，
  不得制造无价值的重复产品代码/测试。
- 本单元未修改 Roadmap、未自动进入 decision、未执行后续任务。

## 5. 边界

- 未扩大 reference scope；未读其它 FastWork tree / `E:\nixiang` / `rebuild`。
- 未复制 reference 内容；未 eval；未联网。
- CSP 保持；`external_network_calls = 0`；schema v7 不变；无 sync/Outbox。