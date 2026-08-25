# DouDian Panel Reference Evidence（SHEEP-033）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.3 · 日期：2026-08-26
> 定位：**DouDian Panel Clean-room Baseline Consolidation + Reference Evidence Gap Record**
> （**不得**宣称完成 Track-A DouDian Panel restoration）
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；Owner-authorized re-verification；未复制/未修改/未 eval/未联网）

## 1. 重新核验方法与结果

- **方法**：SHEEP-022/023 文档复核 + 对 authorized 5-bundle（account/ai/knowledge/navbar/sidebar）只读文本扫描
  （关键字：doudian/douyin/抖店/抖音/pdd/拼多多），抽样行上下文定性。
- **结论（统一表述）**：DouDian Panel DOM/UI layout evidence =
  **NOT FOUND / UNKNOWN / NOT_EVIDENCED_IN_CURRENT_AUTHORIZED_SCOPE**。
  （仅证明 authorized 5-bundle scope 未发现布局证据；**不是**全局意义“DouDian Panel 不存在”。）

## 2. Evidence 定性（含 non_evidence_reason）

| 发现 | claim 等级 | non_evidence_reason |
|---|---|---|
| account/knowledge/navbar 无平台关键字 | CONFIRMED（无命中） | — |
| ai.js L230/L242 抖店 login/功能页 URL | CONFIRMED（URL reference only） | URL 是登录/导航引用，非 renderer panel layout |
| ai.js L248 `'抖店'`、sidebar.js 店铺上下文 | CONFIRMED（平台显示名/店铺类型字符串） | 字符串标记，非布局证据 |
| ai.js L1433-1518 `下载API`/DOM 探测/抽屉面板注释 | CONFIRMED（backend/automation/code/comment reference 存在） | **仅确认相关 backend/automation/code/comment 引用存在；不得因出现 drawer/panel 等词即升级为 Roadmap 所指 DouDian platform browser panel layout evidence** |
| sidebar.js L2957-2966 快通道/倒计时自动回复注释 | CONFIRMED（automation/behavior reference 存在） | 自动化启发式实现引用，非 renderer panel layout |

## 3. REFERENCE_GAP（正式记录）

```
ID: REFERENCE_GAP-DOUDIAN-PANEL
status: OPEN / NOT_EVIDENCED_IN_CURRENT_AUTHORIZED_SCOPE
finding: DouDian platform browser panel UI/layout NOT FOUND in authorized 5-bundle scope
non_evidence: 抖店 URL literals / 平台名与店铺类型字符串 / download-automation-bridge 实现引用
consequence: Track-A DouDian Panel reference restoration 当前无法宣称
resolution: 需 Owner 单独授权 reference discovery，或明确选择 clean-room / non-reference 路线（未自动决定）
```

## 4. Shared platform baseline（复用 SHEEP-032，provisional）

- `empty-platform-panel.ts` + `platform-surface.ts`（平台无关，PDD/DouDian 共用）。
- 复用 SHEEP-032 `renderer-platform-panel-baseline.test.ts` 作为回归证据（**未新建重复测试**）。
- `reference-derived=NO`、`reference_match_status=NOT_ESTABLISHED`、`layout_stability=PROVISIONAL`。
- **SHEEP-033 产品代码变更 = 0；新增测试 = 0。**

## 5. 只读治理观察（只报告趋势，不创建 checkpoint / 不改 Roadmap / 不扩大 scope / 不改 next）

- **Conversation + PDD + DouDian 已形成连续 reference-gap cluster**：
  - SHEEP-030：REFERENCE_GAP-CONVERSATION-WORKBENCH
  - SHEEP-032：REFERENCE_GAP-PDD-PANEL
  - SHEEP-033：REFERENCE_GAP-DOUDIAN-PANEL
- SHEEP-034（Product/Order Context）/ SHEEP-035（Settings）**仍须逐项重新核验**（不得假设）。
- 待 M2.3 缺口核验更完整后，由 **Owner** 决定是否进行 Reference Gap Resolution Checkpoint。

## 6. 边界

- 未扩大 reference scope；未读其它 FastWork tree / `E:\nixiang` / `rebuild`。
- 未复制 reference 内容；未 eval；未联网。
- CSP 保持；`external_network_calls = 0`；schema v7 不变；无 sync/Outbox。