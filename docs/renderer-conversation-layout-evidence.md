# Conversation Layout Reference Evidence（SHEEP-030）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.3 · 日期：2026-08-26
> 定位：**Conversation Clean-room Baseline Consolidation + Reference Evidence Gap Record**
> （**不得**宣称完成 Conversation Reference Restoration）

## 1. REFERENCE_GAP（正式记录）

```
ID: REFERENCE_GAP-CONVERSATION-WORKBENCH
status: OPEN / NOT_EVIDENCED
scope: authorized renderer 5-bundle scope
    (account.js, ai.js, knowledge.js, navbar.js, sidebar.js)
finding: Conversation Workbench layout NOT FOUND / UNKNOWN / NOT_EVIDENCED
    （SHEEP-022：conversation 不在当前 5-bundle 内）
consequence: exact Track-A reference restoration 当前无法宣称
resolution: 需 Owner 后续单独授权 reference discovery，
    或明确选择 clean-room / non-reference 路线（未自动决定）
```

## 2. Fast Sheep clean-room Conversation Baseline（保持不变）

- `conversation-panel.ts`（会话状态/买家/发送状态/接管状态）+ `suggestion-panel.ts`
  （AI 建议 + 手动/不保存发送/取消）——M6 clean-room，数据来自 typed viewModel。
- **SHEEP-030 产品代码变更 = 0**（`conversation-region` 经核实为纯冗余，未引入；
  `styles.css` 未改）。
- `reference-derived = NO`；`reference_match_status = NOT_ESTABLISHED`；
  `layout_stability = PROVISIONAL`。

## 3. M2.3 后续 Acceptance Units 证据影响评估（只报告，不修改 Roadmap / 不自动决策）

| Unit | reference 证据状态 | 影响 |
|---|---|---|
| SHEEP-031 AI Panel | **CONFIRMED in scope**（ai.js：左栏功能列表/右栏聊天区/欢迎页，SHEEP-022） | 可继续 reference-restoration 路线 |
| SHEEP-032 PDD Panel | **UNKNOWN**（不在 5-bundle scope） | 受同一 REFERENCE_GAP 影响（CONFIRMED 缺失） |
| SHEEP-033 DouDian Panel | **UNKNOWN**（不在 5-bundle scope） | 受同一 REFERENCE_GAP 影响（CONFIRMED 缺失） |
| SHEEP-034 Product/Order Context | **UNKNOWN**（不在 5-bundle scope） | 受同一 REFERENCE_GAP 影响（INFERRED 缺失） |
| SHEEP-035 Settings Pages | **UNKNOWN**（不在 5-bundle scope） | 受同一 REFERENCE_GAP 影响（CONFIRMED 缺失） |

> 影响：SHEEP-031 可推进；SHEEP-032/033/034/035 在获得授权 reference discovery
> 或选择 clean-room 路线前，同样无法宣称 exact Track-A restoration。
> 本单元**不修改 Roadmap、不自动进入 decision、不执行后续任务**。

## 4. 边界

- 未扩大读取范围（未读其它 FastWork tree / `E:\nixiang` / `rebuild`）。
- 未复制 reference 内容；未 eval；未联网。
- CSP 保持；`external_network_calls = 0`；schema v7 不变；无 sync/Outbox。