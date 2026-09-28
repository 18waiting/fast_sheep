# 关键定义一致性问题 — 详细记录

**创建日期:** 2026-09-24  
**状态:** 待 Controller 逐个确认  
**目的:** 为 Controller 提供详细的问题分析，支持逐个点名决策  
**来源:** DEFINITION_CONSISTENCY_AUDIT.md (12 个问题中的前 4 个最关键问题)

---

## 问题总览

| 编号 | 问题 | 严重性 | 影响范围 | 阻塞项 |
|------|------|--------|----------|--------|
| **ISSUE-1** | Shop vs Store 身份模型冲突 | 🔴 P0 | 全栈（SQL/TS/IPC/Schema） | 所有新功能开发 |
| **ISSUE-2** | IdentityLock 两个不兼容定义 | 🔴 P0 | ContextEnvelope 实施 | SHEEP-307 及后续 |
| **ISSUE-3** | AI 输入三个竞争格式 | 🔴 P0 | AI Worker 集成 | SHEEP-307 启动 |
| **ISSUE-4** | TypeScript 命名规范混乱 | 🟠 P1 | 代码质量和可维护性 | 长期技术债务 |

---

## ISSUE-1: Shop vs Store — 两套并行的身份模型

### 问题陈述

项目中同时存在 `shop` 和 `store` 两个概念，它们在语义上表示同一件事（"卖家在平台上的销售点"），但在代码中有不同的结构、命名和使用方式。这种冲突贯穿整个技术栈，从数据库表到 TypeScript 接口，从 IPC 通道到 JSON Schema。

### 详细证据

#### 1.1 数据库层冲突

**Legacy 表结构 (migration 0001):**
```sql
-- resources/persistence/migrations/0001_initial.sql
CREATE TABLE shops (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  created_time TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  product_id TEXT PRIMARY KEY,
  shop TEXT NOT NULL DEFAULT '',        -- 注意：字段名是 shop，不是 shop_id
  title TEXT NOT NULL DEFAULT '',
  ...
);

CREATE TABLE conversations (
  conversation_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,                -- 注意：这里是 shop_id
  buyer_id TEXT NOT NULL,
  ...
);
```

**新身份域 (migration 0005):**
```sql
-- resources/persistence/migrations/0005_identity_domain.sql
CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ...
);

CREATE TABLE platform_accounts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  platform TEXT NOT NULL,
  ...
);

CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  ...
);
```

**新商务域 (migration 0007):**
```sql
-- resources/persistence/migrations/0007_commerce_domain.sql
-- 注意：注释明确说 "store_id DEFERRED"
CREATE TABLE customers (
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  platform_account_id TEXT NOT NULL REFERENCES platform_accounts(id),
  platform_customer_id TEXT NOT NULL,
  ...
  -- 没有 store_id 字段
);

CREATE TABLE orders (
  ...
  -- 没有 store_id 字段
);
```

**新知识域 (migration 0008):**
```sql
-- resources/persistence/migrations/0008_store_knowledge.sql
CREATE TABLE store_knowledge (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  store_id TEXT NOT NULL,              -- 使用 store_id
  ...
);
```

**冲突总结:**
- `shops` 表 (0001) 和 `stores` 表 (0005) 同时存在
- `conversations.shop_id` (0001) vs `store_knowledge.store_id` (0008)
- `products.shop` (0001) 使用不同字段名
- `customers` 和 `orders` 没有 store_id（注释说 DEFERRED）

#### 1.2 TypeScript 接口冲突

**Legacy ShopRecord:**
```typescript
// packages/persistence/src/repositories/shop-repository.ts
export interface ShopRecord {
  id: string;
  type: string;
  name: string;
  created_time?: string | null;
  enabled: boolean;
  order: number;
}

// 使用示例
const shop = await shopRepo.findById(shopId);
```

**New StoreRecord:**
```typescript
// packages/persistence/src/repositories/identity-repositories.ts
export interface StoreRecord {
  id: string;
  merchantId: string;          // camelCase
  name: string;
  platform: string;
}

// 使用示例
const store = await storeRepo.findById(storeId);
```

**冲突:**
- 字段不同：`ShopRecord` 有 `type`, `enabled`, `order`；`StoreRecord` 有 `merchantId`, `platform`
- 命名规范不同：`ShopRecord` 用 snake_case (`created_time`)；`StoreRecord` 用 camelCase (`merchantId`)
- 两个 repository 都在使用中

#### 1.3 IPC 通道冲突

**Orchestrator/Platform 命令（全部使用 shop_id）:**
```typescript
// apps/desktop/src/main/ipc/command-handlers.ts
export const IPC = {
  setMode: 'orchestrator:set-mode',
  manualSend: 'orchestrator:manual-send',
  cancel: 'orchestrator:cancel',
  focus: 'orchestrator:focus',
  platformActivateShop: 'platform:activate-shop',
  platformSetViewBounds: 'platform:set-view-bounds',
  platformReload: 'platform:reload',
} as const;

// Handler 实现
[IPC.setMode]: async (req: { shop_id: string; mode: string }) => { ... }
[IPC.manualSend]: async (req: { shop_id: string; conversation_id: string }) => { ... }
[IPC.cancel]: async (req: { shop_id: string; conversation_id: string }) => { ... }
[IPC.focus]: async (req: { shop_id: string }) => { ... }
[IPC.platformActivateShop]: async (req: { shop_id: string }) => { ... }
[IPC.platformSetViewBounds]: async (req: { shop_id: string; bounds: any }) => { ... }
[IPC.platformReload]: async (req: { shop_id: string }) => { ... }
```

**Store Knowledge 查询（使用 store_id）:**
```typescript
// apps/desktop/src/main/ipc/query-handlers.ts
[IPC.storeKnowledgeQuery]: async (req: { 
  merchant_id: string; 
  store_id: string;        // 使用 store_id
  ...
}) => { ... }

[IPC.storeKnowledgeList]: async (req: { 
  merchant_id: string; 
  store_id: string;        // 使用 store_id
  ...
}) => { ... }
```

**冲突:**
- 同一个 IPC 边界，一半用 `shop_id`，一半用 `store_id`
- 调用者需要知道哪个通道用哪个术语
- 容易出错

#### 1.4 JSON Schema 冲突

**使用 shop_id 的 Schema:**
```json
// resources/contracts/schemas/domain/conversation.schema.json
{
  "$id": "fastwork:domain:conversation",
  "required": ["conversation_id", "shop_id", "buyer", "state"],
  "properties": {
    "conversation_id": { "type": "string" },
    "shop_id": { "type": "string" },
    "buyer": { ... },
    "state": { ... }
  }
}

// resources/contracts/schemas/domain/conversation-context.schema.json
{
  "$id": "fastwork:domain:conversation-context",
  "required": ["conversation_id", "shop_id", "buyer", "question"],
  "properties": {
    "shop_id": { "type": "string" }
  }
}

// resources/contracts/schemas/conversation/conversation-engine-request.schema.json
{
  "$id": "fastwork:conversation:engine-request",
  "properties": {
    "shop_id": { "type": "string" }
  }
}
```

**使用 store_id 的 Schema:**
```json
// resources/contracts/schemas/domain/context-envelope.schema.json
{
  "$id": "fastwork:domain:context-envelope",
  "required": ["envelope_id", "merchant_id", "store_id", ...],
  "properties": {
    "store_id": { "type": "string" }
  }
}

// resources/contracts/schemas/domain/store-knowledge.schema.json
{
  "$id": "fastwork:domain:store-knowledge",
  "required": ["merchant_id", "store_id", ...],
  "properties": {
    "store_id": { "type": "string" }
  }
}
```

**冲突:**
- 旧 Schema 用 `shop_id`，新 Schema 用 `store_id`
- 数据在不同 Schema 之间转换时需要手动映射
- 容易出错

### 影响分析

1. **开发效率降低**
   - 开发者需要记住哪个层用哪个术语
   - 跨层操作需要手动转换
   - 容易混淆和出错

2. **数据一致性风险**
   - 同一个概念在不同地方有不同的 ID
   - 数据迁移和同步复杂
   - 查询和关联困难

3. **新功能开发阻塞**
   - 新功能不知道该用 `shop` 还是 `store`
   - Schema 设计不确定
   - API 设计不确定

4. **技术债务累积**
   - 每增加一个新功能，冲突就更多
   - 后期修复成本更高

### 解决方向（待决策）

#### 选项 A: 统一为 Store（推荐）

**理由:**
- `store` 是更现代的术语
- 新架构（merchant → platform_account → store）更清晰
- 符合行业惯例（Shopify, WooCommerce 都用 store）
- ContextEnvelope 和新 Schema 已经用 `store`

**实施步骤:**
1. 创建迁移脚本，将 `shops` 表重命名为 `stores`（或创建视图）
2. 更新所有 TypeScript 接口，统一为 `StoreRecord`
3. 更新所有 IPC 通道，统一为 `store_id`
4. 更新所有 JSON Schema，统一为 `store_id`
5. 更新所有代码引用
6. 测试和验证

**风险:**
- 工作量大
- 需要仔细测试
- 可能破坏现有功能

#### 选项 B: 保持现状，明确边界

**理由:**
- 最小改动
- 不破坏现有功能

**实施步骤:**
1. 文档化 `shop` 和 `store` 的区别
2. 明确哪个层用哪个术语
3. 在转换点添加明确的映射代码
4. 新功能根据所在层选择术语

**风险:**
- 技术债务继续累积
- 开发者仍然容易混淆
- 长期维护成本高

#### 选项 C: 混合方案

**理由:**
- 平衡改动和风险

**实施步骤:**
1. 新代码统一用 `store`
2. 旧代码逐步迁移
3. 在边界层添加适配器和转换器
4. 文档化迁移路径

**风险:**
- 迁移期间两套术语并存
- 需要维护适配器代码

### 依赖关系

- **阻塞:** ISSUE-2, ISSUE-3（都依赖身份模型明确）
- **被阻塞:** 无
- **相关文件:** 20+ 文件（见审计文档）

### 决策建议

**推荐选项 A（统一为 Store）**，理由：
1. 长期收益大于短期成本
2. 符合架构演进方向
3. 减少技术债务
4. 提高代码质量

**实施优先级:** 最高（P0）

---

## ISSUE-2: IdentityLock — 两个不兼容的定义

### 问题陈述

`IdentityLock` 概念在两个地方有不同的定义，一个是 TypeScript 接口（SHEEP-303），一个是 JSON Schema（SHEEP-306）。这两个定义在字段命名、结构和语义上都不兼容，导致无法在它们之间正确转换数据。

### 详细证据

#### 2.1 TypeScript 定义 (SHEEP-303)

```typescript
// apps/desktop/src/main/services/inbound-turn-builder.ts
export interface InboundTurnScope {
  merchantId: string;
  platform: string;
  shopId: string;              // camelCase, flat structure
  customerId: string | null;   // 可为 null
  conversationId: string;
  triggerMessageId: string;
}

// 使用示例
const scope: InboundTurnScope = {
  merchantId: 'merchant-123',
  platform: 'pdd',
  shopId: 'shop-456',
  customerId: null,            // 可以为 null
  conversationId: 'conv-789',
  triggerMessageId: 'msg-abc',
};
```

**特点:**
- camelCase 命名
- 扁平结构
- `customerId` 可为 `null`
- 使用 `shopId`（不是 `storeId`）
- 所有字段都是必需的（除了 `customerId` 可为 null）

#### 2.2 JSON Schema 定义 (SHEEP-306)

```json
// resources/contracts/schemas/domain/context-envelope.schema.json
{
  "$id": "fastwork:domain:context-envelope",
  "definitions": {
    "IdentityLock": {
      "type": "object",
      "required": ["merchant_id", "platform", "store_id", "customer_identity", "conversation_id"],
      "properties": {
        "merchant_id": { "type": "string" },
        "platform": { "type": "string" },
        "store_id": { "type": "string" },
        "customer_identity": {
          "type": "object",
          "required": ["kind", "value"],
          "properties": {
            "kind": {
              "type": "string",
              "enum": ["customerUid", "buyer_id", "user_id"]
            },
            "value": { "type": "string" }
          }
        },
        "conversation_id": { "type": "string" },
        "trigger_message_id": { "type": "string" }
      }
    }
  }
}
```

**特点:**
- snake_case 命名
- 嵌套结构（`customer_identity` 是对象）
- `customer_identity` 不能为 null，必须有 `kind` 和 `value`
- 使用 `store_id`（不是 `shopId`）
- `trigger_message_id` 是可选的（不在 required 中）

#### 2.3 冲突对比

| 字段 | TS (InboundTurnScope) | Schema (IdentityLock) | 冲突 |
|------|----------------------|----------------------|------|
| 商家 ID | `merchantId` | `merchant_id` | 命名规范不同 |
| 平台 | `platform` | `platform` | ✅ 一致 |
| 店铺 ID | `shopId` | `store_id` | **命名和术语都不同** |
| 客户 ID | `customerId: string \| null` | `customer_identity: {kind, value}` | **结构完全不同** |
| 会话 ID | `conversationId` | `conversation_id` | 命名规范不同 |
| 触发消息 ID | `triggerMessageId` | `trigger_message_id` | 命名规范不同 |

#### 2.4 实际使用场景

**TypeScript 使用 (inbound-turn-builder.ts):**
```typescript
// 构建 InboundTurnScope
const scope: InboundTurnScope = {
  merchantId: turn.merchantId,
  platform: turn.platform,
  shopId: turn.shopId,
  customerId: turn.customerId,  // 可能为 null
  conversationId: turn.conversationId,
  triggerMessageId: turn.triggerMessageId,
};

// 用于 identity lock
await identityLockRepo.acquire(scope);
```

**JSON Schema 使用 (context-envelope.schema.json):**
```json
// ContextEnvelope 包含 IdentityLock
{
  "envelope_id": "env-123",
  "merchant_id": "merchant-123",
  "store_id": "store-456",
  "customer_identity": {
    "kind": "customerUid",
    "value": "customer-789"
  },
  "conversation_id": "conv-abc",
  "trigger_message_id": "msg-def"
}
```

**冲突场景:**
1. TypeScript 代码创建 `InboundTurnScope`
2. 需要转换为 `ContextEnvelope` 的 `IdentityLock`
3. 字段名不同，结构不同，无法直接转换
4. 需要手动映射，容易出错

### 影响分析

1. **ContextEnvelope 实施阻塞**
   - SHEEP-306 定义了 ContextEnvelope，但没有 builder
   - 无法从现有的 `InboundTurnScope` 构建 `ContextEnvelope`
   - SHEEP-307 需要 ContextEnvelope，被阻塞

2. **数据转换错误风险**
   - 手动映射容易出错
   - `customerId: null` vs `customer_identity: {kind, value}` 语义不同
   - 可能丢失数据或创建无效的 IdentityLock

3. **类型安全问题**
   - TypeScript 类型和 JSON Schema 不一致
   - 运行时验证可能失败
   - 编译时检查无法捕获错误

4. **代码重复**
   - 需要在多个地方写转换代码
   - 维护成本高
   - 容易不一致

### 解决方向（待决策）

#### 选项 A: 统一为 Schema 定义（推荐）

**理由:**
- Schema 是契约，应该是权威来源
- Schema 定义更完整（`customer_identity` 有 `kind` 和 `value`）
- 符合 snake_case 规范（与 SQL 一致）
- ContextEnvelope 是新架构，应该以它为准

**实施步骤:**
1. 更新 TypeScript 接口，匹配 Schema 定义
2. 重命名 `InboundTurnScope` 为 `IdentityLock`
3. 将 `customerId: string | null` 改为 `customer_identity: {kind, value}`
4. 更新所有使用 `InboundTurnScope` 的代码
5. 添加转换函数（如果需要兼容旧代码）
6. 测试和验证

**风险:**
- 需要修改多处代码
- `customerId: null` 的处理需要重新设计
- 需要更新测试

#### 选项 B: 保持两个定义，添加转换器

**理由:**
- 最小改动
- 不破坏现有代码

**实施步骤:**
1. 创建转换函数 `InboundTurnScope → IdentityLock`
2. 处理 `customerId: null` 的情况
3. 在需要时调用转换函数
4. 文档化转换规则

**风险:**
- 两个定义继续存在
- 转换代码需要维护
- 容易忘记调用转换函数

#### 选项 C: 重新设计 IdentityLock

**理由:**
- 现有两个定义都有问题
- 可以设计一个更好的定义

**实施步骤:**
1. 分析使用场景
2. 设计新的 IdentityLock 定义
3. 更新 TypeScript 和 Schema
4. 迁移现有代码
5. 测试和验证

**风险:**
- 工作量大
- 需要仔细设计
- 可能引入新问题

### 依赖关系

- **阻塞:** SHEEP-307（需要 ContextEnvelope）
- **被阻塞:** ISSUE-1（需要明确 shop vs store）
- **相关文件:** 
  - `apps/desktop/src/main/services/inbound-turn-builder.ts`
  - `apps/desktop/src/main/services/canonical-inbound-persistence.ts`
  - `resources/contracts/schemas/domain/context-envelope.schema.json`

### 决策建议

**推荐选项 A（统一为 Schema 定义）**，理由：
1. Schema 是契约，应该是权威来源
2. 减少重复和混淆
3. 符合架构演进方向
4. 提高类型安全

**实施优先级:** 最高（P0）

---

## ISSUE-3: AI 输入 — 三个竞争请求格式

### 问题陈述

项目中存在三个不同的 AI 输入请求格式，它们在不同的地方定义，有不同的字段和结构。实际使用的是最旧的格式，新定义的格式没有 builder 也没有 consumer，导致数据流断裂。

### 详细证据

#### 3.1 Format A: ConversationEngineRequest（实际使用）

```json
// resources/contracts/schemas/conversation/conversation-engine-request.schema.json
{
  "$id": "fastwork:conversation:engine-request",
  "type": "object",
  "required": ["conversation_id", "shop_id", "buyer", "question"],
  "properties": {
    "conversation_id": { "type": "string" },
    "shop_id": { "type": "string" },
    "buyer": {
      "type": "object",
      "required": ["buyer_id"],
      "properties": {
        "buyer_id": { "type": "string" },
        "buyer_nickname": { "type": "string" }
      }
    },
    "question": { "type": "string" },
    "context": {
      "type": "object",
      "properties": {
        "recent_messages": { "type": "array" },
        "order_id": { "type": "string" }
      }
    }
  }
}
```

**Python 消费者:**
```python
# services/ai-worker/src/fastwork_ai_worker/rpc/methods/conversation.py
class ConversationEngineRequest(BaseModel):
    conversation_id: str
    shop_id: str
    buyer: Dict[str, Any]
    question: str
    context: Optional[Dict[str, Any]] = None

async def handle_conversation_engine_request(
    req: ConversationEngineRequest
) -> Dict[str, Any]:
    # 实际处理逻辑
    ...
```

**特点:**
- 使用 `shop_id`（legacy 术语）
- 使用 `buyer` 对象
- 扁平结构
- **实际在使用**

#### 3.2 Format B: GenerationRequest（定义但无人用）

```json
// resources/contracts/schemas/domain/generation-request.schema.json
{
  "$id": "fastwork:domain:generation-request",
  "type": "object",
  "required": ["request_id", "merchant_id", "platform", "input"],
  "properties": {
    "request_id": { "type": "string" },
    "merchant_id": { "type": "string" },
    "platform": { "type": "string" },
    "input": {
      "type": "object",
      "required": ["type", "content"],
      "properties": {
        "type": { "type": "string", "enum": ["customer_message"] },
        "content": { "type": "string" }
      }
    },
    "context": {
      "type": "object",
      "properties": {
        "conversation_id": { "type": "string" },
        "customer_identity": { ... }
      }
    }
  }
}
```

**特点:**
- 使用 `merchant_id`（新术语）
- 使用 `input` 对象（更抽象）
- 有 `request_id`
- **定义但无人使用**
- **没有 builder**
- **没有 consumer**

#### 3.3 Format C: ContextEnvelope（SHEEP-306 定义，无实现）

```json
// resources/contracts/schemas/domain/context-envelope.schema.json
{
  "$id": "fastwork:domain:context-envelope",
  "type": "object",
  "required": [
    "envelope_id",
    "merchant_id",
    "store_id",
    "conversation_id",
    "customer_identity",
    "inbound_turn",
    "knowledge",
    "reply_plan"
  ],
  "properties": {
    "envelope_id": { "type": "string" },
    "merchant_id": { "type": "string" },
    "store_id": { "type": "string" },
    "conversation_id": { "type": "string" },
    "customer_identity": {
      "type": "object",
      "required": ["kind", "value"],
      "properties": {
        "kind": { "type": "string", "enum": ["customerUid", "buyer_id", "user_id"] },
        "value": { "type": "string" }
      }
    },
    "inbound_turn": {
      "type": "object",
      "required": ["message_id", "content", "timestamp"],
      "properties": {
        "message_id": { "type": "string" },
        "content": { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" }
      }
    },
    "knowledge": {
      "type": "object",
      "properties": {
        "system_facts": { "type": "array" },
        "platform_facts": { "type": "array" },
        "merchant_facts": { "type": "array" },
        "store_facts": { "type": "array" },
        "product_facts": { "type": "array" }
      }
    },
    "reply_plan": {
      "type": "object",
      "properties": {
        "plan_id": { "type": "string" },
        "actions": { "type": "array" }
      }
    }
  }
}
```

**特点:**
- 最完整的定义
- 包含 knowledge 和 reply_plan
- 使用 `store_id`（新术语）
- **没有 builder**
- **没有 consumer**
- **没有实际使用**

#### 3.4 数据流现状

**当前数据流（使用 Format A）:**
```
Desktop App
  ↓ (构建 ConversationEngineRequest)
  ↓ { conversation_id, shop_id, buyer, question, context }
  ↓
AI Worker (Python)
  ↓ (消费 ConversationEngineRequest)
  ↓ 处理逻辑
  ↓
返回结果
```

**期望数据流（使用 Format C）:**
```
Desktop App
  ↓ (构建 ContextEnvelope)
  ↓ { envelope_id, merchant_id, store_id, conversation_id, 
  ↓   customer_identity, inbound_turn, knowledge, reply_plan }
  ↓
AI Worker (Python)
  ↓ (消费 ContextEnvelope)
  ↓ 处理逻辑
  ↓
返回结果
```

**现实:**
- Format A 在使用，但是 legacy 格式
- Format B 定义但无人用
- Format C 定义但无 builder 无 consumer
- 数据流断裂

### 影响分析

1. **SHEEP-307 阻塞**
   - SHEEP-307 需要实现 ContextEnvelope builder
   - 但没有明确的 consumer（AI Worker 还在用 Format A）
   - 无法完成端到端集成

2. **架构演进受阻**
   - 新架构（ContextEnvelope）无法落地
   - 继续依赖 legacy 格式
   - 技术债务累积

3. **知识注入困难**
   - ContextEnvelope 设计包含 knowledge 字段
   - 但实际使用的 Format A 没有这个字段
   - 无法注入分层知识（DEC-008）

4. **Reply Plan 无法实施**
   - ContextEnvelope 设计包含 reply_plan
   - 但实际使用的 Format A 没有这个字段
   - Reply Plan 演进（REPLY_PLAN_EVOLUTION.md）无法落地

### 解决方向（待决策）

#### 选项 A: 实施 ContextEnvelope（推荐）

**理由:**
- 这是架构设计的目标
- 包含完整的知识注入和 Reply Plan
- 符合 DEC-008（分层知识架构）
- 支持 REPLY_PLAN_EVOLUTION.md

**实施步骤:**
1. 创建 ContextEnvelope Builder（TypeScript）
2. 更新 AI Worker，添加 ContextEnvelope consumer（Python）
3. 创建 Format A → Format C 转换器（过渡期）
4. 逐步迁移到 Format C
5. 废弃 Format A 和 Format B
6. 测试和验证

**风险:**
- 工作量大
- 需要修改 AI Worker
- 过渡期需要维护转换器

#### 选项 B: 增强 Format A

**理由:**
- 最小改动
- 不破坏现有功能

**实施步骤:**
1. 在 Format A 中添加 knowledge 字段
2. 在 Format A 中添加 reply_plan 字段
3. 更新 AI Worker 处理新字段
4. 文档化新字段

**风险:**
- Format A 变得臃肿
- 不符合架构设计
- 技术债务继续累积

#### 选项 C: 保持现状，先完成其他任务

**理由:**
- Format A 能用
- 先完成其他阻塞项

**实施步骤:**
1. 继续使用 Format A
2. 先解决 ISSUE-1 和 ISSUE-2
3. 后续再考虑迁移到 Format C

**风险:**
- 架构演进继续延迟
- SHEEP-307 无法启动
- 技术债务累积

### 依赖关系

- **阻塞:** SHEEP-307（需要明确的 AI 输入格式）
- **被阻塞:** ISSUE-1（需要明确 shop vs store）, ISSUE-2（需要明确 IdentityLock）
- **相关文件:**
  - `resources/contracts/schemas/conversation/conversation-engine-request.schema.json`
  - `resources/contracts/schemas/domain/generation-request.schema.json`
  - `resources/contracts/schemas/domain/context-envelope.schema.json`
  - `services/ai-worker/src/fastwork_ai_worker/rpc/methods/conversation.py`

### 决策建议

**推荐选项 A（实施 ContextEnvelope）**，理由：
1. 这是架构设计的目标
2. 支持分层知识注入
3. 支持 Reply Plan 演进
4. 符合长期架构方向

**实施优先级:** 最高（P0）

---

## ISSUE-4: TypeScript 命名规范混乱 — camelCase vs snake_case

### 问题陈述

TypeScript 代码中命名规范不统一，有些地方用 camelCase，有些地方用 snake_case，甚至同一个文件内混用。这导致代码可读性差，容易出错，增加维护成本。

### 详细证据

#### 4.1 camelCase 使用场景

**Identity Repositories:**
```typescript
// packages/persistence/src/repositories/identity-repositories.ts
export interface StoreRecord {
  id: string;
  merchantId: string;      // camelCase
  name: string;
  platform: string;
}

export interface MerchantRecord {
  id: string;
  name: string;
  createdAt: string;       // camelCase
}
```

**Inbound Turn Builder:**
```typescript
// apps/desktop/src/main/services/inbound-turn-builder.ts
export interface InboundTurnScope {
  merchantId: string;      // camelCase
  platform: string;
  shopId: string;          // camelCase
  customerId: string;      // camelCase
  conversationId: string;  // camelCase
  triggerMessageId: string; // camelCase
}
```

#### 4.2 snake_case 使用场景

**Shop Repository:**
```typescript
// packages/persistence/src/repositories/shop-repository.ts
export interface ShopRecord {
  id: string;
  type: string;
  name: string;
  created_time?: string | null;  // snake_case
  enabled: boolean;
  order: number;
}
```

**Store Knowledge Service:**
```typescript
// apps/desktop/src/main/services/store-knowledge-service.ts
interface StoreKnowledgeQuery {
  merchant_id: string;     // snake_case
  store_id: string;        // snake_case
  entry_type?: string;     // snake_case
}
```

**IPC Handlers:**
```typescript
// apps/desktop/src/main/ipc/command-handlers.ts
[IPC.setMode]: async (req: { 
  shop_id: string;         // snake_case
  mode: string 
}) => { ... }

[IPC.manualSend]: async (req: { 
  shop_id: string;         // snake_case
  conversation_id: string  // snake_case
}) => { ... }
```

#### 4.3 混用场景

**Query Handlers:**
```typescript
// apps/desktop/src/main/ipc/query-handlers.ts
// 同一个文件内混用
[IPC.storeKnowledgeQuery]: async (req: { 
  merchant_id: string;     // snake_case
  store_id: string;        // snake_case
  ...
}) => { ... }

[IPC.shopList]: async (req: { 
  // 没有参数
}) => { ... }

// 但返回的 ShopRecord 用 snake_case
const shops: ShopRecord[] = await shopRepo.findAll();
// ShopRecord { created_time, ... }
```

**Conversation Engine:**
```typescript
// apps/desktop/src/main/services/conversation-engine.ts
// 请求用 camelCase
interface EngineRequest {
  conversationId: string;  // camelCase
  shopId: string;          // camelCase
  buyerId: string;         // camelCase
}

// 但调用 IPC 时用 snake_case
await ipcRenderer.invoke(IPC.manualSend, {
  shop_id: req.shopId,           // 转换
  conversation_id: req.conversationId  // 转换
});
```

#### 4.4 SQL ↔ TypeScript 映射问题

**没有统一的映射层:**
```typescript
// 散落在各处的 mapRow 函数

// shop-repository.ts
private mapRow(row: any): ShopRecord {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    created_time: row.created_time,  // 直接映射
    enabled: row.enabled === 1,
    order: row.sort_order,
  };
}

// identity-repositories.ts
private mapRow(row: any): StoreRecord {
  return {
    id: row.id,
    merchantId: row.merchant_id,     // 转换
    name: row.name,
    platform: row.platform,
  };
}

// store-knowledge-repository.ts
private mapRow(row: any): StoreKnowledgeRecord {
  return {
    id: row.id,
    merchant_id: row.merchant_id,    // 不转换
    store_id: row.store_id,          // 不转换
    ...
  };
}
```

**问题:**
- 每个 repository 都有自己的 mapRow 实现
- 有的转换（camelCase），有的不转换（snake_case）
- 没有统一的映射策略
- 容易出错

### 影响分析

1. **代码可读性差**
   - 开发者需要记住每个接口用哪种命名规范
   - 跨文件操作时需要 mental context switch
   - 容易混淆

2. **容易出错**
   - 手动转换容易遗漏
   - 字段名拼写错误
   - 类型检查无法捕获（因为都是 string）

3. **维护成本高**
   - 每个 repository 都需要 mapRow
   - 重复代码
   - 修改时需要更新多处

4. **技术债务**
   - 命名规范不统一
   - 代码风格不一致
   - 新人上手困难

### 解决方向（待决策）

#### 选项 A: 统一为 camelCase（TypeScript 标准）

**理由:**
- TypeScript/JavaScript 标准是 camelCase
- 符合行业惯例
- 与前端代码一致

**实施步骤:**
1. 定义命名规范文档
2. 更新所有接口为 camelCase
3. 创建统一的映射层（SQL snake_case → TS camelCase）
4. 更新所有 mapRow 函数
5. 更新 IPC handlers
6. 测试和验证

**风险:**
- 工作量大
- 需要修改多处代码
- 可能破坏现有功能

#### 选项 B: 统一为 snake_case（与 SQL 一致）

**理由:**
- 与 SQL 一致，减少转换
- 与 Python 代码一致
- 与 JSON Schema 一致

**实施步骤:**
1. 定义命名规范文档
2. 更新所有接口为 snake_case
3. 移除 mapRow 转换（直接映射）
4. 更新 IPC handlers
5. 测试和验证

**风险:**
- 不符合 TypeScript 惯例
- 前端代码可能需要调整
- 工作量大

#### 选项 C: 保持现状，文档化规范

**理由:**
- 最小改动
- 不破坏现有功能

**实施步骤:**
1. 文档化当前命名规范
2. 明确哪个层用哪种规范
3. 新功能根据所在层选择规范
4. 在转换点添加注释

**风险:**
- 技术债务继续累积
- 代码风格不一致
- 长期维护成本高

### 依赖关系

- **阻塞:** 无（但影响代码质量）
- **被阻塞:** 无
- **相关文件:** 30+ 文件

### 决策建议

**推荐选项 A（统一为 camelCase）**，理由：
1. 符合 TypeScript/JavaScript 标准
2. 提高代码可读性
3. 减少错误
4. 长期收益大于短期成本

**实施优先级:** 中（P1）— 可以增量实施

---

## 决策记录模板

每个问题解决后，在此记录决策：

### ISSUE-1 决策

**决策日期:**  
**决策选项:**  
**决策理由:**  
**实施任务:**  
**验证结果:**  

### ISSUE-2 决策

**决策日期:**  
**决策选项:**  
**决策理由:**  
**实施任务:**  
**验证结果:**  

### ISSUE-3 决策

**决策日期:**  
**决策选项:**  
**决策理由:**  
**实施任务:**  
**验证结果:**  

### ISSUE-4 决策

**决策日期:**  
**决策选项:**  
**决策理由:**  
**实施任务:**  
**验证结果:**  

---

**文档创建:** 2026-09-24  
**文档维护:** Controller  
**下一步:** Controller 逐个确认问题并决策

---

## ISSUE-2 决策记录

**决策日期:** 2026-09-28  
**决策选项:** 选项 A — 最小变更（消除矛盾，保留差异）

### 决策内容

1. **保留** Domain Model 的 `IdentityResolution<T>` 包装器（活跃代码，修改成本高）
2. **保留** JSON Schema 的扁平字符串设计（声明性合约，无 consumer）
3. **删除** Domain Model 文件中"mirror JSON Schema"的错误声明
4. **添加注释** 说明两层类型的差异和用途

### 决策理由

| 维度 | 分析 |
|------|------|
| **活跃代码** | Domain Model 被 `pdd-inbound-ingress.ts`、`inbound-to-canonical.ts`、`canonical-inbound-persistence.ts` 活跃使用 |
| **JSON Schema** | 只有 schema 验证测试，没有 builder/consumer，是纯声明性的（SHEEP-306 仅定义合约） |
| **矛盾** | Domain Model 声称 mirror JSON Schema 但实际不是，这是自相矛盾 |
| **风险** | 修改 JSON Schema 支持 `IdentityResolution` 会让 schema 变复杂，不值得 |
| **未来** | 等 SHEEP-307 启动时，再决定是否需要映射层 |

### 实施内容

**修改文件:** `packages/domain/src/identity-inbound.ts`

1. 删除文件头部的错误声明：
   ```
   - JSON Schema Draft 2020-12 is the cross-process source of truth. These readonly
   - TypeScript types mirror the canonical schemas without adding mapping,
   - construction, mutation, persistence, or platform behavior.
   ```

2. 添加详细说明：
   - 说明这是领域层类型，不是 JSON Schema 的镜像
   - 列出关键差异（命名规范、结构、类型丰富度）
   - 说明序列化边界和未来映射需求
   - 列出活跃消费者

3. 为 `IdentityResolution<T>` 添加详细注释：
   - 解释三种状态（RESOLVED, UNKNOWN, UNRESOLVED）
   - 说明为什么需要这种丰富度
   - 说明与 JSON Schema 的差异是有意为之

### 验证结果

- ✅ `packages/domain` typecheck 通过
- ✅ 无破坏性变更
- ✅ 消除了自相矛盾

### 遗留问题

1. **Domain Model 与 JSON Schema 仍然不一致**
   - 这是有意为之，因为两者服务于不同目的
   - Domain Model 是领域层，表达身份解析状态
   - JSON Schema 是序列化层，用于跨进程通信

2. **未来需要映射层**
   - 当 SHEEP-307 启动，ContextEnvelope 需要 consumer 时
   - 需要实现 Domain Model ↔ JSON Schema 的映射
   - 这个映射应该显式实现，而不是隐式假设

3. **`customer_identity` 设计待验证**
   - JSON Schema 的 `{kind, value}` 设计支持多平台
   - 但 MVP-A 只针对 PDD，可能是过早优化
   - 等 PDD 流程跑通后，再评估是否需要简化

### 下一步

- 继续 ISSUE-3（AI 输入三个竞争格式）
- 等 SHEEP-307 启动时，再实现映射层

---

## ISSUE-3 决策记录

**决策日期:** 2026-09-28  
**决策选项:** 选项 A+C — 保留 Format B（不删除），为 Format A 添加 TypeScript 类型

### 决策内容

1. **保留** `generation-request.schema.json`（Format B）— 虽然它是概念性的，但在注册表中被引用，删除会破坏注册表
2. **为 Format A 添加 TypeScript 类型** — 创建 `packages/contracts/src/generated/conversation.ts`
3. **保留 Format C** — 等 SHEEP-307 授权后再实施

### 决策理由

| 维度 | 分析 |
|------|------|
| **Format B** | 在 `registry.json` 中被引用，关联行为合约（B-PROV-002, B-PROV-003, B-PROV-004），删除需要修改多个文件 |
| **Format A** | 实际在用（Python 端验证并使用），但缺少 TypeScript 类型定义 |
| **Format C** | SHEEP-306 明确说"Contract definition only"，PROJECT_STATE.json 说"do not execute SHEEP-306" |
| **风险** | 删除 Format B 可能破坏行为合约验证 |

### 实施内容

**新增文件:** `packages/contracts/src/generated/conversation.ts`

1. `ConversationEngineRequest` — Format A 的请求类型
2. `ConversationMessage` — 聊天历史消息类型
3. `ConversationContext` — 对话上下文类型
4. `ConversationEngineResult` — 响应类型
5. `ConversationTraceEntry` — 调试追踪类型
6. `HandoffDecision` — 转人工决策类型

**更新文件:** `packages/contracts/src/index.ts`

- 导出新增的类型

### 验证结果

- ✅ `packages/contracts` typecheck 通过
- ✅ 类型定义与 JSON Schema 一致
- ✅ 无破坏性变更

### 遗留问题

1. **三个格式仍然共存**
   - Format A: 实际在用，现在有 TypeScript 类型
   - Format B: 概念性，在注册表中被引用
   - Format C: 纯声明性，等 SHEEP-307

2. **迁移到 Format C 的时机**
   - 需要等 PDD 流程跑通
   - 需要 SHEEP-307 授权
   - 需要实现 ContextEnvelope builder 和 consumer

3. **Format B 的处理**
   - 目前保留，因为它在注册表中被引用
   - 未来可以考虑标记为 deprecated
   - 或者在行为合约迁移后删除

### 下一步

- 继续 ISSUE-4（TypeScript 命名规范统一）
- 等 PDD 流程跑通后，再考虑迁移到 Format C

---

## ISSUE-4 决策记录

**决策日期:** 2026-09-28  
**决策选项:** 选项 C — 文档化现状，不做大范围重命名

### 决策内容

1. **保留** 当前命名规范（camelCase 和 snake_case 混用）
2. **文档化** 各层的命名规范
3. **不做大范围重命名** — 涉及 81+ 处修改，风险大于收益

### 决策理由

| 维度 | 分析 |
|------|------|
| **工作量** | 81+ 处 snake_case 使用，涉及多个 repository 和 IPC handler |
| **风险** | 大规模重命名可能破坏现有功能 |
| **收益** | 提高代码可读性，但不阻塞功能开发 |
| **优先级** | P1（不是 P0），可以延后处理 |

### 当前命名规范现状

| 层级 | 命名规范 | 示例 |
|------|---------|------|
| **Identity Domain (新)** | camelCase | `merchantId`, `platformAccountId` |
| **Legacy Shop Domain** | snake_case | `created_time`, `sort_order` |
| **IPC Handlers** | snake_case | `shop_id`, `conversation_id` |
| **SQL Schema** | snake_case | `merchant_id`, `store_id` |
| **Python Code** | snake_case | `customer_uid`, `buyer_id` |

### 文档化规范

**TypeScript 层:**
- **新代码（Identity Domain）**: 使用 camelCase
- **Legacy 代码（Shop Domain）**: 保持 snake_case
- **IPC 层**: 使用 snake_case（与 SQL 一致）

**映射规则:**
- SQL snake_case → TypeScript camelCase（在 Identity Domain repository 中转换）
- SQL snake_case → TypeScript snake_case（在 Legacy repository 中直接映射）
- IPC snake_case → TypeScript camelCase（在 service 层转换）

### 实施内容

**无代码变更** — 仅文档化现状

### 验证结果

- ✅ 无破坏性变更
- ✅ 文档化当前规范

### 遗留问题

1. **命名规范仍然不统一**
   - Identity Domain 用 camelCase
   - Legacy Shop Domain 用 snake_case
   - IPC 层用 snake_case

2. **技术债务继续累积**
   - 新代码可能继续混用
   - 需要代码审查来确保一致性

3. **未来统一的可能性**
   - 等 Legacy 代码迁移完成后，可以考虑统一为 camelCase
   - 或者保持现状，通过文档化来管理差异

### 下一步

- 完成最终验证（全项目编译）
- 提交代码
- 后续可以考虑：
  1. 添加 ESLint 规则来强制命名规范
  2. 创建统一的映射层工具函数
  3. 逐步迁移 Legacy 代码到 camelCase

---

## 总结

### 四个 ISSUE 的处理结果

| ISSUE | 问题 | 决策 | 状态 |
|-------|------|------|------|
| **ISSUE-1** | Shop vs Store 语义冲突 | 方向 B：明确语义分离 + 清理半成品 | ✅ 完成 |
| **ISSUE-2** | IdentityLock 定义冲突 | 选项 A：消除矛盾，保留差异 | ✅ 完成 |
| **ISSUE-3** | AI 输入三个竞争格式 | 选项 A+C：保留 Format B，为 Format A 添加类型 | ✅ 完成 |
| **ISSUE-4** | TypeScript 命名规范混乱 | 选项 C：文档化现状，不做大范围重命名 | ✅ 完成 |

### 下一步

1. **最终验证** — 全项目编译
2. **提交代码** — 包含所有 ISSUE 的修复
3. **后续任务** — 等 PDD 流程跑通后，再考虑架构演进
