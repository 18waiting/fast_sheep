# RAG 资料库架构设计

**Status:** PROPOSED — awaiting Controller review  
**Created:** 2026-09-28  
**Supersedes:** SHEEP-305 原设计（最小知识管道）  
**Related:** DEC-008 (Layered Knowledge), PDD_MVP_V1 §6 (Knowledge V1)

---

## 1. 设计目标

### 1.1 用户愿景

> "知识信息放在店铺规则、商品规则等信息里，作为 agent 的 RAG 资料库"

### 1.2 架构目标

1. **统一的知识架构** — 支持多种知识类型（店铺规则、商品规则、订单信息等）
2. **分层知识存储** — 符合 DEC-008 的分层知识架构
3. **智能检索** — 支持关键词检索（MVP）→ 向量检索（Phase 9）
4. **可扩展** — 新增知识类型不需要改代码

---

## 2. 现有架构评估

### 2.1 已有的基础设施

✅ **Schema 层**
- `store-knowledge.schema.json` — 定义了 Store 层知识条目结构
- 支持多种知识类型（SHIPPING_TIME, RETURN_POLICY, FAQ, OTHER）
- 支持 tags 字段用于检索

✅ **持久化层**
- `0008_store_knowledge.sql` — 创建了 store_knowledge 表
- 支持按 merchant_id + store_id 范围过滤
- 支持按 knowledge_type 过滤

✅ **Repository 层**
- `store_knowledge_repository.py` — 实现了关键词检索（SQL LIKE）
- 支持范围过滤、类型过滤、关键词检索

### 2.2 现有架构的局限

❌ **只支持 Store 层** — 没有 Merchant 层、Product 层
❌ **知识类型硬编码** — 新增类型需要改 schema 和代码
❌ **检索方式单一** — 只有关键词匹配，没有向量检索
❌ **没有统一的检索接口** — 不同知识类型需要不同的查询逻辑

---

## 3. RAG 资料库架构设计

### 3.1 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent (Reply Generation)          │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ query(knowledge_query)
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Knowledge Retrieval Service                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  1. Query Parsing (场景识别 + 关键词提取)        │  │
│  │  2. Scope Resolution (merchant + store + product)│  │
│  │  3. Type Routing (路由到对应的知识类型)          │  │
│  │  4. Retrieval (关键词/向量检索)                  │  │
│  │  5. Ranking & Filtering (排序 + 过滤)            │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ retrieve(scope, type, query)
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Knowledge Repository Layer                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Store Rules  │  │Product Rules │  │ Order Facts  │ │
│  │ Repository   │  │ Repository   │  │ Repository   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Knowledge Storage Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │store_knowledge│  │product_know..│  │ order_facts  │ │
│  │   (SQLite)   │  │   (SQLite)   │  │   (SQLite)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.2 分层知识架构（DEC-008 实现）

| 层级 | 知识类型 | 存储表 | 示例 |
|------|---------|--------|------|
| **System/Platform** | 平台规则 | `platform_knowledge` | PDD 平台政策、通用规则 |
| **Merchant** | 商家规则 | `merchant_knowledge` | 商家通用政策 |
| **Store** | 店铺规则 | `store_knowledge` | 发货时间、退换货政策 |
| **Product** | 商品规则 | `product_knowledge` | 商品规格、库存、价格 |
| **Conversation** | 临时上下文 | `conversation_context` | 当前对话状态 |

### 3.3 知识类型注册机制

**问题：** 现有架构中知识类型是硬编码的枚举

**解决方案：** 引入知识类型注册表

```typescript
// packages/domain/src/knowledge/knowledge-type-registry.ts

export interface KnowledgeTypeDefinition {
  type: string;                    // e.g., "SHIPPING_TIME"
  displayName: string;             // e.g., "发货时间规则"
  layer: KnowledgeLayer;           // STORE | PRODUCT | MERCHANT
  schema: JSONSchema;              // 知识条目的 schema
  retrievalStrategy: RetrievalStrategy;  // KEYWORD | VECTOR | HYBRID
  validators: KnowledgeValidator[];
}

export class KnowledgeTypeRegistry {
  private types = new Map<string, KnowledgeTypeDefinition>();

  register(definition: KnowledgeTypeDefinition): void {
    this.types.set(definition.type, definition);
  }

  get(type: string): KnowledgeTypeDefinition | undefined {
    return this.types.get(type);
  }

  listByLayer(layer: KnowledgeLayer): KnowledgeTypeDefinition[] {
    return Array.from(this.types.values()).filter(t => t.layer === layer);
  }
}

// 初始化注册
const registry = new KnowledgeTypeRegistry();

registry.register({
  type: "SHIPPING_TIME",
  displayName: "发货时间规则",
  layer: "STORE",
  schema: shippingTimeSchema,
  retrievalStrategy: "KEYWORD",
  validators: [shippingTimeValidator],
});

registry.register({
  type: "PRODUCT_SPEC",
  displayName: "商品规格",
  layer: "PRODUCT",
  schema: productSpecSchema,
  retrievalStrategy: "KEYWORD",
  validators: [productSpecValidator],
});
```

### 3.4 统一检索接口

```typescript
// packages/domain/src/knowledge/knowledge-retrieval.ts

export interface KnowledgeQuery {
  merchantId: string;
  storeId?: string;
  productId?: string;
  scene: SceneType;              // SHIPPING_TIME | PRODUCT_INQUIRY | ...
  keywords: string[];
  limit?: number;
}

export interface KnowledgeRetrievalResult {
  entries: KnowledgeEntry[];
  confidence: number;
  retrievalMethod: "KEYWORD" | "VECTOR" | "HYBRID";
}

export interface KnowledgeRetrievalService {
  retrieve(query: KnowledgeQuery): Promise<KnowledgeRetrievalResult>;
}

// 实现
class KnowledgeRetrievalServiceImpl implements KnowledgeRetrievalService {
  constructor(
    private registry: KnowledgeTypeRegistry,
    private storeRepo: StoreKnowledgeRepository,
    private productRepo: ProductKnowledgeRepository,
    // ...
  ) {}

  async retrieve(query: KnowledgeQuery): Promise<KnowledgeRetrievalResult> {
    // 1. 根据 scene 确定需要查询的知识类型
    const relevantTypes = this.getRelevantTypes(query.scene);

    // 2. 根据知识类型路由到对应的 repository
    const entries = await Promise.all(
      relevantTypes.map(type => this.retrieveByType(type, query))
    );

    // 3. 合并、排序、过滤
    const merged = this.mergeAndRank(entries.flat());

    return {
      entries: merged.slice(0, query.limit ?? 20),
      confidence: this.calculateConfidence(merged),
      retrievalMethod: "KEYWORD",  // MVP 阶段
    };
  }

  private async retrieveByType(
    type: KnowledgeTypeDefinition,
    query: KnowledgeQuery
  ): Promise<KnowledgeEntry[]> {
    switch (type.layer) {
      case "STORE":
        return this.storeRepo.query(
          query.merchantId,
          query.storeId!,
          query.keywords,
          type.type
        );
      case "PRODUCT":
        return this.productRepo.query(
          query.merchantId,
          query.productId!,
          query.keywords,
          type.type
        );
      // ...
    }
  }
}
```

---

## 4. 迁移策略

### 4.1 Phase 1: 基础架构（SHEEP-305 重新定义）

**目标：** 建立 RAG 资料库基础架构，支持 SHIPPING_TIME 作为第一个知识类型

**任务：**
1. ✅ 保留现有 `store_knowledge` 表和 repository
2. 创建知识类型注册表（`KnowledgeTypeRegistry`）
3. 创建统一检索接口（`KnowledgeRetrievalService`）
4. 将 SHIPPING_TIME 注册为第一个知识类型
5. 在 AI reply generation 中集成检索服务

**交付物：**
- `packages/domain/src/knowledge/knowledge-type-registry.ts`
- `packages/domain/src/knowledge/knowledge-retrieval.ts`
- 集成测试：AI 可以使用 SHIPPING_TIME 知识生成回复

### 4.2 Phase 2: 扩展知识类型

**目标：** 支持更多知识类型

**任务：**
1. 添加 PRODUCT_SPEC 知识类型（商品规格）
2. 添加 RETURN_POLICY 知识类型（退换货政策）
3. 添加 FAQ 知识类型
4. 创建 Product 层知识表（`product_knowledge`）

### 4.3 Phase 9: 向量检索

**目标：** 引入向量检索，提升检索质量

**任务：**
1. 集成 embedding 模型
2. 实现向量存储（FAISS 或类似）
3. 实现混合检索（关键词 + 向量）
4. 实现重排序（reranking）

---

## 5. 与原 SHEEP-305 的对比

| 维度 | 原设计（最小知识管道） | 新设计（RAG 资料库） |
|------|----------------------|---------------------|
| **范围** | 只做 SHIPPING_TIME | 支持多种知识类型 |
| **架构** | 独立的规则管道 | 统一的知识架构 |
| **扩展性** | 每加一种规则就要改代码 | 注册新知识类型即可 |
| **检索** | 简单的关键词匹配 | 统一检索接口（支持未来向量检索） |
| **工作量** | 小 | 中等（但一步到位） |
| **符合用户愿景** | ❌ 不符合 | ✅ 符合 |

---

## 6. 风险和缓解

### 6.1 风险

1. **工作量增加** — 需要创建注册表和统一检索接口
2. **过度设计** — MVP 阶段可能不需要这么复杂的架构
3. **与现有代码不兼容** — 需要迁移现有的 knowledge repository

### 6.2 缓解

1. **渐进式实施** — Phase 1 只做基础架构，不实现所有知识类型
2. **保持简单** — 注册表和检索接口保持最小化，不过度抽象
3. **向后兼容** — 保留现有的 `store_knowledge_repository.py`，新的检索服务调用它

---

## 7. 决策请求

**请求 Controller 决策：**

1. **是否同意重新定义 SHEEP-305** — 从"最小知识管道"改为"RAG 资料库基础架构"
2. **是否同意分层知识架构** — 支持 System/Merchant/Store/Product/Conversation 五层
3. **是否同意知识类型注册机制** — 通过注册表管理知识类型，而不是硬编码
4. **SHIPPING_TIME 作为第一个知识类型** — 在 RAG 架构下实现

---

## 8. 参考

- DEC-008 (Layered Knowledge Architecture)
- PDD_MVP_V1 §6 (Knowledge V1)
- store-knowledge.schema.json
- 0008_store_knowledge.sql
- store_knowledge_repository.py

---

**Document created:** 2026-09-28  
**Author:** Codex  
**Review authority:** Controller
