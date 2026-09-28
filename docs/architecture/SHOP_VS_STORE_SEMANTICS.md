# Shop vs Store 语义定义

**Status:** PROPOSED — awaiting Controller review  
**Created:** 2026-09-24  
**Updated:** 2026-09-24 (修正关联模式)  
**Supersedes:** 无（首次明确定义）  
**Related:** AI_CUSTOMER_SERVICE_CORE.md §2 (IdentityLock), DEC-027, DEC-039

---

## 1. 问题背景

项目中同时存在 `Shop` 和 `Store` 两个概念，代码中混用导致歧义。本文档明确定义两者的语义边界，消除隐式混用。

**核心原则（来自 AI_CUSTOMER_SERVICE_CORE.md §2）：**

> If a legacy runtime `ShopRecord` identity is needed, it is a runtime binding identity only. It MUST NOT be silently equated with the canonical domain `Store` identity.

---

## 2. 语义定义

### 2.1 Store（领域模型概念）

**定义：** Store 是领域模型中的身份实体，表示"卖家在平台上的销售点"的权威身份。

**特征：**
- 属于身份域（Identity Domain）
- 有明确的归属关系：Merchant → Store → PlatformAccount
- 是知识、策略、审计的归属边界
- 是 IdentityLock 的组成部分
- 是跨平台统一身份的载体

**使用场景：**
- 身份管理（merchant, store, platform_account）
- 知识归属（store_knowledge）
- 会话归属（normalized_conversations.store_id）
- 身份锁定（IdentityLock.store_id）
- 跨平台身份映射

**数据结构：**
```typescript
// packages/persistence/src/repositories/identity-repositories.ts
interface StoreRecord {
  id: string;
  merchantId: string;      // 归属商家
  name: string;            // 店铺名称
  platform: string;        // 所属平台
}
```

**SQL 表：**
```sql
-- resources/persistence/migrations/0005_identity_domain.sql
CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  name TEXT NOT NULL,
  platform TEXT NOT NULL
);
```

**命名规范：**
- TypeScript: camelCase (`storeId`, `merchantId`)
- SQL: snake_case (`store_id`, `merchant_id`)
- JSON Schema: snake_case (`store_id`, `merchant_id`)

---

### 2.2 Shop（运行时/UI 概念）

**定义：** Shop 是运行时和 UI 层的概念，表示"用户当前激活的会话上下文"。

**特征：**
- 属于运行时域（Runtime Domain）
- 表示用户当前正在操作的"店铺视图"
- 与平台会话（Platform Session）绑定
- 是 UI 状态的一部分（激活、焦点、视图边界）
- 是 IPC 通信的上下文标识

**使用场景：**
- UI 展示（店铺列表、侧边栏）
- 会话激活（activate_shop, focus_shop）
- 视图管理（set_view_bounds, reload）
- IPC 通信（所有 orchestrator 命令）
- 平台会话管理（shop_id 作为会话标识）

**数据结构：**
```typescript
// apps/desktop/src/main/services/shop-service.ts
interface ShopRow {
  shop_id: string;         // 运行时标识（存储在 PlatformAccount.externalRef）
  name: string;            // 显示名称
  type: string;            // 平台类型（pdd, doudian, jd, ...）
  enabled: boolean;        // 是否启用
}
```

**Legacy 数据结构（兼容）：**
```typescript
// packages/persistence/src/repositories/shop-repository.ts
interface ShopRecord {
  id: string;
  type: string;
  name: string;
  created_time?: string | null;
  enabled: boolean;
  order: number;
}
```

**SQL 表（Legacy）：**
```sql
-- resources/persistence/migrations/0001_initial.sql
CREATE TABLE shops (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  ...
);
```

**命名规范：**
- TypeScript: snake_case（保持 legacy 兼容）(`shop_id`)
- IPC: snake_case (`shop_id`)
- JSON Schema: snake_case (`shop_id`)

---

## 3. 边界定义

### 3.1 明确分离

| 维度 | Store（领域模型） | Shop（运行时/UI） |
|------|------------------|------------------|
| **所属域** | Identity Domain | Runtime/UI Domain |
| **职责** | 权威身份、知识归属、策略边界 | 会话上下文、UI 状态、IPC 通信 |
| **生命周期** | 长期（商家注册后创建） | 短期（应用启动后激活） |
| **归属关系** | Merchant → Store → PlatformAccount | Shop → PlatformAccount.externalRef |
| **使用层** | Domain Layer, Infrastructure Layer | Application Layer, UI Layer, IPC Layer |
| **命名规范** | camelCase (TS) / snake_case (SQL/Schema) | snake_case (保持 legacy) |

### 3.2 禁止隐式转换

**禁止：**
```typescript
// ❌ 错误：隐式将 Shop 当作 Store
const storeId = shop.shop_id;  // 语义不清
const shop: StoreRecord = { ...shopRecord };  // 类型不匹配
```

**正确：**
```typescript
// ✅ 正确：显式映射
const mapping = await resolveStoreFromShopId(shop.shop_id, platformAccountRepo, storeRepo);
const shop: ShopRow = mapStoreToShopRow(store, shopId);
```

---

## 4. 映射规则

### 4.1 关联模式

**正确的关联模式：**

```
Shop.id → PlatformAccount.externalRef → Store
         (通过 merchantId + platform 关联)
```

**详细说明：**

1. **Shop.id** 存储在 **PlatformAccount.externalRef** 中
2. **PlatformAccount** 通过 **merchantId + platform** 与 **Store** 关联
3. 映射需要经过 PlatformAccount 作为中介

**示例：**

```typescript
// controlled 模式下的数据
const SHOP_ID = "shop-test-1";
const STORE_ID = "store-" + SHOP_ID;  // "store-shop-test-1"
const MERCHANT_ID = "merchant-test";

// Store
{
  id: STORE_ID,
  merchantId: MERCHANT_ID,
  platform: "pdd",
  name: "Test Store"
}

// PlatformAccount
{
  id: "account-test",
  merchantId: MERCHANT_ID,
  platform: "pdd",
  externalRef: SHOP_ID  // ← Shop.id 存储在这里
}
```

### 4.2 Store → Shop（领域到运行时）

**场景：** 将 Store 信息展示在 UI 上，或用于 IPC 通信。

**映射函数：**

```typescript
// apps/desktop/src/main/services/shop-store-mapper.ts
export function mapStoreToShopRow(store: StoreRecord, shopId: string): ShopRow {
  return {
    shop_id: shopId,              // Shop.id 需要外部提供
    name: store.name,
    type: store.platform,         // Store.platform 映射为 Shop.type
    enabled: true,
  };
}
```

**注意：** Store 本身不包含 Shop.id，需要通过 PlatformAccount.externalRef 反向查找。

### 4.3 Shop → Store（运行时到领域）

**场景：** 从 UI 或 IPC 接收 shop_id，需要查询 Store 信息。

**映射函数：**

```typescript
// apps/desktop/src/main/services/shop-store-mapper.ts
export async function resolveStoreFromShopId(
  shopId: string,
  platformAccountRepo: PlatformAccountRepository,
  storeRepo: StoreRepository
): Promise<ShopToStoreMapping | null> {
  // Step 1: 通过 externalRef 查找 PlatformAccount
  const account = platformAccountRepo.findByExternalRef(shopId);
  if (!account) {
    return null;
  }
  
  // Step 2: 通过 merchantId + platform 查找 Store
  const store = storeRepo.findByMerchantAndPlatform(account.merchantId, account.platform);
  if (!store) {
    return null;
  }
  
  return {
    shopId,
    store,
    platformAccountId: account.id,
  };
}
```

**关键点：**
- 需要通过两个步骤完成映射
- 需要 PlatformAccountRepository 和 StoreRepository 两个依赖
- 返回 ShopToStoreMapping 对象，包含完整的映射信息

### 4.4 反向查找：Store → Shop.id

**场景：** 已知 Store，需要找到对应的 Shop.id。

**映射函数：**

```typescript
// apps/desktop/src/main/services/shop-store-mapper.ts
export function findShopIdFromStore(
  store: StoreRecord,
  platformAccountRepo: PlatformAccountRepository
): string | null {
  const accounts = platformAccountRepo.listByMerchant(store.merchantId);
  const account = accounts.find(a => a.platform === store.platform);
  return account?.externalRef ?? null;
}
```

**注意：** 一个 Store 可能对应多个 PlatformAccount（多平台场景），但在 MVP-A 阶段（单平台 PDD），一个 Store 只对应一个 PlatformAccount。

---

## 5. 代码组织

### 5.1 文件职责

| 文件 | 职责 | 使用的概念 |
|------|------|-----------|
| `packages/persistence/src/repositories/identity-repositories.ts` | Store/PlatformAccount 持久化 | Store, PlatformAccount |
| `packages/persistence/src/repositories/shop-repository.ts` | Shop 持久化（Legacy） | Shop |
| `apps/desktop/src/main/services/shop-service.ts` | Shop 运行时服务 | Shop |
| `apps/desktop/src/main/services/shop-store-mapper.ts` | Shop ↔ Store 映射 | Shop + Store + PlatformAccount |
| `apps/desktop/src/main/ipc/command-handlers.ts` | IPC 命令处理 | Shop（保持 legacy） |
| `apps/desktop/src/main/ipc/query-handlers.ts` | IPC 查询处理 | Shop（保持 legacy） |
| `apps/desktop/src/main/services/inbound-turn-builder.ts` | 入站消息聚合 | Shop（运行时）→ Store（领域） |
| `resources/contracts/schemas/domain/context-envelope.schema.json` | ContextEnvelope 定义 | Store |
| `resources/contracts/schemas/desktop/*.schema.json` | Desktop IPC 定义 | Shop |

### 5.2 新增方法

**PlatformAccountRepository 新增：**
```typescript
findByExternalRef(externalRef: string): PlatformAccountRecord | null;
```

**StoreRepository 新增：**
```typescript
findByMerchantAndPlatform(merchantId: string, platform: string): StoreRecord | null;
```

---

## 6. 迁移策略

### Phase 1: 文档化（已完成）
- [x] 创建本文档，明确语义边界
- [x] 修正关联模式（Shop.id → PlatformAccount.externalRef → Store）
- [ ] Controller 审核
- [ ] 合并到主分支

### Phase 2: 添加映射层（已完成）
- [x] 创建 `shop-store-mapper.ts`
- [x] 添加 `findByExternalRef` 方法到 PlatformAccountRepository
- [x] 添加 `findByMerchantAndPlatform` 方法到 StoreRepository
- [x] 在边界点添加显式映射调用
- [x] 添加注释说明映射关系

### Phase 3: 代码审查（建议）
- [ ] 审查所有 `shop_id` 使用点，确认语义
- [ ] 审查所有 `store_id` 使用点，确认语义
- [ ] 确保没有隐式转换

### Phase 4: 测试验证（建议）
- [ ] 添加映射函数的单元测试
- [ ] 添加边界点的集成测试
- [ ] 验证 IdentityLock 构建正确

### Phase 5: 长期演进（可选）
- [ ] 评估是否可以统一为 Store（方向 A）
- [ ] 评估是否需要废弃 Shop（方向 C）

---

## 7. 决策记录

### DEC-XXX — Shop vs Store 语义分离（待 Controller 确认）

**Status:** PROPOSED  
**Date:** 2026-09-24

**Decision:**

Shop 和 Store 是两个不同的概念，应该明确分离：
- **Store** = 领域模型中的身份实体（Identity Domain）
- **Shop** = 运行时/UI 层的会话上下文（Runtime/UI Domain）

**关联模式：**
- Shop.id 存储在 PlatformAccount.externalRef 中
- 通过 merchantId + platform 关联 Store
- 映射需要经过 PlatformAccount 作为中介

**Rationale:**

1. 符合 AI_CUSTOMER_SERVICE_CORE.md §2 的要求（"MUST NOT be silently equated"）
2. 保持向后兼容（Shop 的 legacy 代码不需要大规模重构）
3. 明确职责边界（领域 vs 运行时）
4. 降低迁移风险（不需要一次性改 239 个文件）

**Consequences:**

- 需要维护映射代码（shop-store-mapper.ts）
- 开发者需要理解两个概念的区别和关联模式
- 边界点需要显式映射（增加代码量，但提高清晰度）

---

## 8. 参考

- AI_CUSTOMER_SERVICE_CORE.md §2 (IdentityLock)
- DEC-027 (Multi-Shop-Ready Architecture)
- DEC-039 (Multi-Shop AUTO Isolation Precondition)
- DEFINITION_CONSISTENCY_AUDIT.md (P0-1)
- CRITICAL_DEFINITION_ISSUES.md (ISSUE-1)

---

**Document created:** 2026-09-24  
**Document updated:** 2026-09-24 (修正关联模式)  
**Author:** Codex  
**Review authority:** Controller
