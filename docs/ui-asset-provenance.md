# UI Asset Provenance（SHEEP-024）

> **历史授权/来源证据（非新的访问或商用许可）**：下文 `Reference eligibility = YES` 仅描述 SHEEP-024 当时的限定参考用途，不授权现在重新访问外部树、复制代码/资产或商业再分发。具体权限仍以 [Master](../project/FAST_SHEEP_MASTER_PROMPT.md) 与当前 [PROJECT_STATE.json](../project/PROJECT_STATE.json) 为准；原始 provenance 结论保留。

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.1（Track A archaeology 收官）· 日期：2026-08-25
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ_ONLY_OWNER_AUTHORIZED_UI_REFERENCE）

## 1. Owner Authorization Scope（Master §2.2）

- **已授权（reference/restoration 用途）**：观察/分析/恢复参考 —— HTML/CSS/DOM、信息架构（IA）、
  UI layout、UI-only interaction patterns、本地 renderer visual assets 的**视觉参考**。
- **未授权**：commercial redistribution；直接复制 JS 代码/桥接契约；将参考资产自动纳入
  Fast Sheep commercial asset set。
- **Reference eligibility = YES 仅限上述授权用途边界**；不扩展为代码复制、bridge 复用、
  商业再分发或 commercial asset approval。

## 2. Provenance Ledger

### 2.1 5 个 JS bundle（代码资产）

| 文件 | reference/restoration eligibility | direct code/bridge portability | commercial redistribution eligibility |
|---|---|---|---|
| account.js | YES（授权范围内） | **NOT ESTABLISHED** | **NOT ESTABLISHED** |
| ai.js | YES（授权范围内） | NOT ESTABLISHED | NOT ESTABLISHED |
| knowledge.js | YES（授权范围内） | NOT ESTABLISHED | NOT ESTABLISHED |
| navbar.js | YES（授权范围内） | NOT ESTABLISHED | NOT ESTABLISHED |
| sidebar.js | YES（授权范围内） | NOT ESTABLISHED | NOT ESTABLISHED |

### 2.2 独立 font / icon / image 资产文件

- **当前授权 renderer tree 中无独立 font/icon/image asset files**（CONFIRMED，仅指独立资产文件）。
- **不推断** bundle 内不存在 inline SVG、icon definitions、data URI、CSS-in-JS、generated visual
  expressions 等；本任务未新增读取，这些内容的 provenance/license 状态 = **UNKNOWN / NOT_EVIDENCED_IN_CURRENT_SCOPE**。

### 2.3 未来候选资产规则（不自动 UNKNOWN）

- 进入 commercial asset set **之前**必须有**独立 provenance/license evidence**；
- 有证据 → 按证据分类；无证据 → `UNKNOWN / NOT_EVIDENCED_IN_CURRENT_SCOPE`；
- **UNKNOWN 不得升级为"确认无许可/非法"或"确认有许可"**。

## 3. 结论

- 当前 commercial asset set 候选：**无**（无独立视觉资产文件；JS bundle 无 redistribution evidence）。
- 后续 restoration：仅 UI 结构/IA/布局可参考；代码/桥接/资产一律按 Fast Sheep 自有架构与
  asset-license gate 处理。