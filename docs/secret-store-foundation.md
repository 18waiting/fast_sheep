# SecretStore Foundation（M1.5-R01）

> 项目：Fast Sheep / 快羊客服 · Phase 1 / M1.5 · 状态：FOUNDATION（含最小 OS-backed 实现）· 日期：2026-08-25
> 范围：最小 OS-backed secure local SecretStore 能力/契约 + 测试双实现 + 安全边界。
> **不实现** Seller Credential / BYOK provider 调用 / rotate / Phase 13 完整 hardening。

## 1. 实际 OS-backed mechanism（报告要求）

- **机制**：注入式 `SecureCipher`（`packages/secret-store/src/os-backed.ts`），在 **Electron Main** 中注入
  Electron **`safeStorage`** —— Windows 上基于 **DPAPI** 的 OS 级加密（macOS Keychain / Linux libsecret）。
  加密后的 blob 以 base64 持久化到本地 JSON 文件（临时文件+原子 rename；文件**无明文**）。
- **为何是 minimum secure local implementation**：直接复用 OS 密钥保护（DPAPI），无需自研密钥管理；
  接口注入使实现可替换，**未把 DPAPI/safeStorage 写成永久唯一架构**（Phase 13 可扩展）。
- **runtime fallback**：**FAIL CLOSED** —— OS cipher 不可用时构造即抛错，**绝不 silent fallback 到
  InMemory / plaintext**。任何解密/存储失败抛错，错误不含 secret 值。

## 2. 契约与纪律

- 最小接口：`set / get / remove / has`；**不强制 rotate**（R-01 note）。
- `remove` 仅承诺 **logical removal**，不承诺无法证明的 forensic secure erase。
- errors/debug/serialization **不含 secret value**；`has()` 不通过暴露 value 实现；无便利序列化接口。
- key 纪律：`<namespace>.<name>` 惯例（如 `byok.openai.key`），最小稳定性校验；**不设计**
  PDD/DouDian/BYOK 完整业务 taxonomy。
- `InMemorySecretStore` = **TEST_ONLY / NOT_PRODUCTION_SAFE**，构造需 `{testOnly:true}` 守卫。

## 3. Privileged boundary（不变式）

真实 secret **不进入** Renderer / SQLite / logs / DOM / localStorage / model prompt（Master §5/§11）。
Backup Manager **不感知** SecretStore；DB backup 不含 plaintext secret（M1.5-R06 联动负验证）。

## 4. 未实现（Phase 13 / 后续）

- 完整 hardening / lifecycle / migration / audit / privacy（Phase 13 SHEEP-240~243）
- Seller Credential / BYOK provider 调用 / rotate
- PDD/DouDian/BYOK 业务 key taxonomy

## 5. 验收基线（本任务确认）

- Renderer exposure = NO；SQLite plaintext = NO；logs/errors plaintext = NO；DB backup plaintext = NO
- schema version 仍为 v7；0001~0007 migrations 未变；未改既有 domain/persistence