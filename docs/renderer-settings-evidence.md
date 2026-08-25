# Settings Reference Evidence（SHEEP-035）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.3 · 日期：2026-08-26
> 定位：**Settings Pages Clean-room Baseline Consolidation + Reference Evidence Gap Record**
> （**不得**宣称完成 Track-A Settings restoration）
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；Owner-authorized re-verification；未复制/未修改/未 eval/未联网）

## 1. 逐项核验：Target Settings evidence vs related-but-distinct evidence（严格区分）

| 类别 | 结论 | 说明 / non_evidence_reason |
|---|---|---|
| **独立 Settings 页面/面板 layout** | **NOT FOUND / UNKNOWN / NOT_EVIDENCED_IN_CURRENT_AUTHORIZED_SCOPE** | SHEEP-022：「设置页…当前 5 个 bundle 中未出现」 |
| **account.js account/login/expiry UI** | **CONFIRMED related evidence（明确 `NOT Settings`）** | 账号信息/登录/到期闸门（SHEEP-022）——与 Settings 概念不同，**保留供未来相关 UX 参考**；login/credential 部分 DO_NOT_PORT_DIRECTLY |
| account.js「设置登录加载态()」函数 | CONFIRMED（登录页内部实现） | 登录页加载态实现，非 Settings 页面证据 |
| ai.js FAQ「千牛设置/倒计时调整/提示词设置」（L151-186） | CONFIRMED（AI 助手 FAQ 内容） | 帮助内容提及设置位置，非 Settings 页面布局 |
| sidebar.js「设置 store / 协同设置 / settings-store」（L1093-1099） | CONFIRMED（配置数据引用） | 运行时配置数据源，非 Settings 页面布局 |
| 配置项/选项/bridge/auth 标记 | DO_NOT_PORT_DIRECTLY / 非布局证据 | 配置/bridge/auth 概念，与 Settings 页面布局无关 |

> **概念区分**：account ≠ settings；auth/credential ≠ settings；config/settings-store ≠ settings page layout。

## 2. REFERENCE_GAP（正式记录）

```
ID: REFERENCE_GAP-SETTINGS-PAGES
status: OPEN / NOT_EVIDENCED_IN_CURRENT_AUTHORIZED_SCOPE
finding: Settings 页面 UI/page/layout NOT FOUND in authorized 5-bundle scope
related_but_distinct: account.js account/login/expiry UI = CONFIRMED（NOT Settings，保留供相关 UX 参考）
consequence: Track-A Settings Pages reference restoration 当前无法宣称
resolution: 需 Owner 单独授权 reference discovery，或明确选择 clean-room / non-reference 路线（未自动决定）
```

## 3. Fast Sheep clean-room baseline（现状）

- renderer 现**无** Settings 页面/面板 UI。
- 记录：`clean_room_ui_baseline = NOT_IMPLEMENTED`、`layout_status = NOT_IMPLEMENTED`、
  `reference_match_status = NOT_ESTABLISHED`、`reference-derived = NO`。
- **Settings 后续实现：仅记录 `deferred to later roadmap phase/unit`**——不锁定具体 Phase、
  页面架构或与 Account/BYOK/SecretStore/Cloud 的组合方式；当前只确认 **M2.3 不实现**。
- **SHEEP-035 产品代码变更 = 0；新增测试 = 0。**

## 4. M2.3 evidence coverage 观察 + Checkpoint 推荐（只推荐，不创建）

- gap-cluster：Conversation（SHEEP-030）+ PDD（SHEEP-032）+ DouDian（SHEEP-033）+
  Product/Order Context（SHEEP-034）+ **Settings（SHEEP-035）**；SHEEP-031（AI Panel）有 in-scope 证据。
- **Settings gap 成立**（本任务确认）。
- **推荐（仅推荐，不创建/不执行/不修改 Roadmap）**：以 **`REFERENCE_GAP_RESOLUTION_CHECKPOINT`**
  作为下一个 **Owner decision point**，由 Owner 决定是否进入（含是否扩大 reference scope / 选择
  clean-room 路线）。是否创建由 Owner 单独决定。

## 5. 边界

- 未扩大 reference scope；未读其它 FastWork tree / `E:\nixiang` / `rebuild`。
- 未复制 reference 内容；未 eval；未联网。
- CSP 保持；`external_network_calls = 0`；schema v7 不变；无 sync/Outbox。
- **完成后 STOP；不自动进入下一阶段 / 不自动创建 Checkpoint。**