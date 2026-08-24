# Minimal Entitlement Contract（M1.5-R03）

> 项目：Fast Sheep / 快羊客服 · Phase 1 / M1.5 · 状态：CONTRACT（商业资格边界，非授权引擎）· 日期：2026-08-25

## 1. 范围

- 只负责**商业资格边界**（feature 是否被商业授权可用），**不实现授权引擎**。
- Capability / Resource Scope（SHEEP-012）与 Entitlement **保持独立**；无 role→entitlement、
  capability→entitlement、工具权限判断（Phase 8+）。
- Cloud-authoritative Subscription / Entitlement / AI Gateway = Phase 11（SHEEP-200~215）。

## 2. 契约（packages/domain/src/entitlement.ts）

- `EntitlementId`（可扩展 string；**无业务 taxonomy / 无 PDD_ENABLED 等枚举**）。
- `EntitlementEvidenceKind` = `cloud_authoritative | signed_offline_lease | local_permitted`。
- `EntitlementEvidence`（kind + opaque ref）；`EntitlementDecision`（allow | deny+reason）。
- `LocalEntitlementBoundary.evaluate(required, evidence)`。

## 3. Local boundary 语义（DenyByDefaultLocalEntitlementBoundary）

- **No fail-open**：无 evidence / 未知 kind / 无效 evidence → **deny**（结构性规则，非硬编码 UNKNOWN=>DISABLED 表）。
- `signed_offline_lease`：**Phase 1 按 R-03 接受为可构成 evidence 的 kind（allow）**；签名/有效期/scope/grace
  验证 = **Phase 11（SHEEP-203~207）**。Phase 1 不做完整验证（不实现小型授权系统）。
- `cloud_authoritative`：本地无法验证 → **fail closed**（reason=`..._requires_authoritative_verification`）；
  **不是永久无效**，属"需要权威验证"。
- `local_permitted`：**可信授权 evidence，不是本地 boolean 开关**；无 trusted verifier → fail closed。
- **reason/error 均为静态通用字符串**，不含 secret / lease 内容 / signature / ref / 敏感商业信息。

## 4. 与 M1.5-R01 联动

- Entitlement evidence 的 ref 不应包含明文 secret；本契约 reason 不回显任何 ref。
- 完整 lease 签名/校验在 Phase 11 与 Cloud 侧完成；本地只消费 evidence kind。