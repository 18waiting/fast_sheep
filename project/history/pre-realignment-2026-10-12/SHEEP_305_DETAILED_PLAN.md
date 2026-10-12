# SHEEP-305 详细执行计划

> **任务:** RAG Knowledge Base 场景路由集成
> **创建日期:** 2026-09-29
> **状态:** 待 Controller 授权
> **前置任务:** SHEEP-304 ✅ → SHEEP-306 ✅
> **总工作量:** 5 天
> **设计文档:** `docs/architecture/RAG_KNOWLEDGE_BASE.md`

---

## 一、任务总览

### 目标

让 ConversationEngine 根据场景传递 knowledge_type/store_knowledge_type 参数，实现场景→知识类型的路由。

### 现状

- ✅ IndexBuilder 已支持 store_knowledge
- ✅ RAGEngine 已支持 knowledge_type 过滤
- ✅ Retriever 已支持 knowledge_type + store_knowledge_type
- ❌ ConversationEngine 调用 RAGEngine 时没有传递 knowledge_type 参数
- ❌ SHEEP-306 Builder 使用 stub 知识检索

### 执行顺序

```
3.1 场景→知识类型映射（0.5 天）
    ↓
3.2 ConversationEngine 集成场景路由（1 天）
    ↓
3.3 TypeScript 侧类型定义对齐（0.5 天）
    ↓
3.4 SHEEP-306 Builder 集成真实知识检索（1.5 天）
    ↓
3.5 端到端测试（1.5 天）
```

---

## 二、详细任务分解

### 3.1 场景→知识类型映射（0.5 天）

#### 目标

定义场景到知识类型的映射关系，支持根据场景查询对应的 knowledge_type 和 store_knowledge_type。

#### 具体工作

**文件:** `services/ai-worker/src/fastwork_ai_worker/conversation/scene_knowledge_mapping.py`（新建）

**内容:**

```python
"""Scene to Knowledge Type Mapping

Maps conversation scenes to knowledge types for RAG retrieval filtering.
"""
from typing import Dict, Optional, Tuple

# Scene → (knowledge_type, store_knowledge_type) mapping
SCENE_KNOWLEDGE_MAPPING: Dict[str, Tuple[str, Optional[str]]] = {
    "SHIPPING_TIME": ("STORE_RULE", "SHIPPING_TIME"),
    "RETURN_POLICY": ("STORE_RULE", "RETURN_POLICY"),
    "PRODUCT_INQUIRY": ("PRODUCT_KNOWLEDGE", None),
    "FAQ": ("STORE_RULE", "FAQ"),
}

# Default mapping when scene is not recognized
DEFAULT_MAPPING: Tuple[str, Optional[str]] = ("ALL", None)

def get_knowledge_filter(scene: str) -> Tuple[str, Optional[str]]:
    """Get knowledge_type and store_knowledge_type for a given scene.
    
    Args:
        scene: Scene identifier (e.g., "SHIPPING_TIME")
    
    Returns:
        Tuple of (knowledge_type, store_knowledge_type)
        - knowledge_type: "STORE_RULE" | "PRODUCT_KNOWLEDGE" | "ALL"
        - store_knowledge_type: "SHIPPING_TIME" | "RETURN_POLICY" | "FAQ" | None
    
    Examples:
        >>> get_knowledge_filter("SHIPPING_TIME")
        ("STORE_RULE", "SHIPPING_TIME")
        >>> get_knowledge_filter("UNKNOWN_SCENE")
        ("ALL", None)
    """
    return SCENE_KNOWLEDGE_MAPPING.get(scene, DEFAULT_MAPPING)
```

#### 验收标准

- [ ] **AC-1.1:** 文件创建成功，语法正确
- [ ] **AC-1.2:** `get_knowledge_filter("SHIPPING_TIME")` 返回 `("STORE_RULE", "SHIPPING_TIME")`
- [ ] **AC-1.3:** `get_knowledge_filter("RETURN_POLICY")` 返回 `("STORE_RULE", "RETURN_POLICY")`
- [ ] **AC-1.4:** `get_knowledge_filter("PRODUCT_INQUIRY")` 返回 `("PRODUCT_KNOWLEDGE", None)`
- [ ] **AC-1.5:** `get_knowledge_filter("UNKNOWN_SCENE")` 返回 `("ALL", None)`（默认映射）
- [ ] **AC-1.6:** 单元测试覆盖所有场景

#### 测试文件

**文件:** `services/ai-worker/tests/test_scene_knowledge_mapping.py`（新建）

**测试用例:**

```python
def test_shipping_time_mapping():
    assert get_knowledge_filter("SHIPPING_TIME") == ("STORE_RULE", "SHIPPING_TIME")

def test_return_policy_mapping():
    assert get_knowledge_filter("RETURN_POLICY") == ("STORE_RULE", "RETURN_POLICY")

def test_product_inquiry_mapping():
    assert get_knowledge_filter("PRODUCT_INQUIRY") == ("PRODUCT_KNOWLEDGE", None)

def test_faq_mapping():
    assert get_knowledge_filter("FAQ") == ("STORE_RULE", "FAQ")

def test_unknown_scene_default():
    assert get_knowledge_filter("UNKNOWN") == ("ALL", None)
```

#### 依赖

- 无依赖，可以独立开始

---

### 3.2 ConversationEngine 集成场景路由（1 天）

#### 目标

修改 ConversationEngine，在调用 RAGEngine 时根据场景传递 knowledge_type 和 store_knowledge_type 参数。

#### 具体工作

**文件:** `services/ai-worker/src/fastwork_ai_worker/conversation/conversation_engine.py`（修改）

**修改内容:**

1. **导入映射模块:**

```python
from .scene_knowledge_mapping import get_knowledge_filter
```

2. **修改 `generate()` 方法中的 RAGEngine 调用:**

**当前代码（约第 200 行）:**

```python
# 6. PRODUCT_RETRIEVAL (embedding failure -> degraded error)
try:
    retrieval = self.rag_engine.retrieve(
        {"query": question, "product_id": product_id, "order_state": order["order_state"], "top_k": 15}
    )
```

**修改后:**

```python
# 6. PRODUCT_RETRIEVAL (embedding failure -> degraded error)
try:
    # Get scene from request (if available)
    scene = request.get("scene") or request.get("scene_classification", {}).get("scene")
    
    # Get knowledge filter based on scene
    knowledge_type, store_knowledge_type = get_knowledge_filter(scene) if scene else ("ALL", None)
    
    # Build retrieve request
    retrieve_request = {
        "query": question,
        "product_id": product_id,
        "order_state": order["order_state"],
        "top_k": 15,
    }
    
    # Add knowledge filters if not "ALL"
    if knowledge_type != "ALL":
        retrieve_request["knowledge_type"] = knowledge_type
        if store_knowledge_type:
            retrieve_request["store_knowledge_type"] = store_knowledge_type
    
    retrieval = self.rag_engine.retrieve(retrieve_request)
```

3. **添加 trace 记录:**

```python
self._add(trace, "SceneKnowledgeMapping", "SCENE_FILTER", f"scene={scene}, knowledge_type={knowledge_type}, store_knowledge_type={store_knowledge_type}")
```

#### 验收标准

- [ ] **AC-2.1:** ConversationEngine 可以获取场景信息（从 request 中）
- [ ] **AC-2.2:** SHIPPING_TIME 场景调用 RAGEngine 时传递 `knowledge_type="STORE_RULE"` 和 `store_knowledge_type="SHIPPING_TIME"`
- [ ] **AC-2.3:** RETURN_POLICY 场景调用 RAGEngine 时传递 `knowledge_type="STORE_RULE"` 和 `store_knowledge_type="RETURN_POLICY"`
- [ ] **AC-2.4:** PRODUCT_INQUIRY 场景调用 RAGEngine 时传递 `knowledge_type="PRODUCT_KNOWLEDGE"`
- [ ] **AC-2.5:** 无场景或未知场景时，不传递 knowledge_type（向后兼容，检索所有类型）
- [ ] **AC-2.6:** trace 记录包含场景和过滤信息
- [ ] **AC-2.7:** 现有测试不被破坏（向后兼容）
- [ ] **AC-2.8:** 新增测试覆盖场景路由

#### 测试文件

**文件:** `services/ai-worker/tests/test_conversation_engine_scene_routing.py`（新建）

**测试用例:**

```python
def test_shipping_time_scene_routing():
    """Test that SHIPPING_TIME scene filters to STORE_RULE + SHIPPING_TIME"""
    # Mock RAGEngine to capture retrieve request
    # Call generate() with scene="SHIPPING_TIME"
    # Verify retrieve() called with knowledge_type="STORE_RULE", store_knowledge_type="SHIPPING_TIME"

def test_return_policy_scene_routing():
    """Test that RETURN_POLICY scene filters to STORE_RULE + RETURN_POLICY"""
    # Similar to above

def test_product_inquiry_scene_routing():
    """Test that PRODUCT_INQUIRY scene filters to PRODUCT_KNOWLEDGE"""
    # Similar to above

def test_no_scene_backward_compatible():
    """Test that no scene retrieves all knowledge types"""
    # Call generate() without scene
    # Verify retrieve() called without knowledge_type filter

def test_unknown_scene_backward_compatible():
    """Test that unknown scene retrieves all knowledge types"""
    # Call generate() with scene="UNKNOWN"
    # Verify retrieve() called without knowledge_type filter
```

#### 依赖

- 依赖 3.1（场景→知识类型映射）

---

### 3.3 TypeScript 侧类型定义对齐（0.5 天）

#### 目标

在 TypeScript 侧定义与 Python 侧对齐的知识类型和场景映射。

#### 具体工作

**文件:** `packages/domain/src/knowledge.ts`（新建或更新）

**内容:**

```typescript
/**
 * Knowledge Type (aligned with Python side)
 */
export type KnowledgeType = "STORE_RULE" | "PRODUCT_KNOWLEDGE" | "ALL";

/**
 * Store Knowledge Type (aligned with Python side)
 */
export type StoreKnowledgeType = "SHIPPING_TIME" | "RETURN_POLICY" | "FAQ" | "OTHER";

/**
 * Scene to Knowledge Type Mapping
 */
export const SCENE_KNOWLEDGE_MAPPING: Record<string, { knowledgeType: KnowledgeType; storeKnowledgeType?: StoreKnowledgeType }> = {
  SHIPPING_TIME: { knowledgeType: "STORE_RULE", storeKnowledgeType: "SHIPPING_TIME" },
  RETURN_POLICY: { knowledgeType: "STORE_RULE", storeKnowledgeType: "RETURN_POLICY" },
  PRODUCT_INQUIRY: { knowledgeType: "PRODUCT_KNOWLEDGE" },
  FAQ: { knowledgeType: "STORE_RULE", storeKnowledgeType: "FAQ" },
};

/**
 * Get knowledge filter for a scene
 */
export function getKnowledgeFilter(scene: string): { knowledgeType: KnowledgeType; storeKnowledgeType?: StoreKnowledgeType } {
  return SCENE_KNOWLEDGE_MAPPING[scene] ?? { knowledgeType: "ALL" };
}
```

**文件:** `packages/domain/src/index.ts`（更新）

**添加导出:**

```typescript
export * from "./knowledge.js";
```

#### 验收标准

- [ ] **AC-3.1:** `KnowledgeType` 类型定义正确
- [ ] **AC-3.2:** `StoreKnowledgeType` 类型定义正确
- [ ] **AC-3.3:** `SCENE_KNOWLEDGE_MAPPING` 与 Python 侧一致
- [ ] **AC-3.4:** `getKnowledgeFilter("SHIPPING_TIME")` 返回正确的映射
- [ ] **AC-3.5:** typecheck 通过
- [ ] **AC-3.6:** 导出到 domain 包

#### 依赖

- 无依赖，可以与 3.1 并行

---

### 3.4 SHEEP-306 Builder 集成真实知识检索（1.5 天）

#### 目标

替换 SHEEP-306 的 stub 知识检索为真实实现，通过 RPC 调用 Python 侧的 RAGEngine。

#### 具体工作

**文件 1:** `apps/desktop/src/main/adapters/rpc-store-knowledge-retrieval.ts`（修改）

**当前代码（stub 实现）:**

```typescript
export class StubStoreKnowledgeRetrieval implements StoreKnowledgeRetrievalPort {
  async query(scene: Scene, context: QueryContext): Promise<StoreKnowledgeQueryResult> {
    return { items: [], total: 0 };
  }
}
```

**修改后（RPC 实现）:**

```typescript
import { getKnowledgeFilter } from "@fastwork/domain";
import type { StoreKnowledgeRetrievalPort, StoreKnowledgeQueryResult, StoreKnowledgeItem } from "../ports/store-knowledge-retrieval-port.js";

export interface RpcStoreKnowledgeRetrievalDeps {
  readonly rpcClient: RpcClient; // RPC client to call Python side
}

export class RpcStoreKnowledgeRetrieval implements StoreKnowledgeRetrievalPort {
  constructor(private readonly deps: RpcStoreKnowledgeRetrievalDeps) {}

  async query(scene: Scene, context: QueryContext): Promise<StoreKnowledgeQueryResult> {
    // Get knowledge filter based on scene
    const { knowledgeType, storeKnowledgeType } = getKnowledgeFilter(scene);
    
    // Build RPC request
    const request = {
      query: context.query,
      knowledge_type: knowledgeType !== "ALL" ? knowledgeType : undefined,
      store_knowledge_type: storeKnowledgeType,
      top_k: context.topK ?? 10,
    };
    
    // Call Python side RAGEngine via RPC
    const response = await this.deps.rpcClient.call("rag.retrieve", request);
    
    // Convert response to StoreKnowledgeQueryResult
    return {
      items: response.hits.map((hit: any) => this.convertHitToItem(hit)),
      total: response.hits.length,
    };
  }

  private convertHitToItem(hit: any): StoreKnowledgeItem {
    return {
      knowledge_id: hit.entry_id,
      knowledge_type: hit.knowledge_type,
      store_knowledge_type: hit.store_knowledge_type,
      title: hit.question.split("：")[0] || "",
      content: hit.answer,
      relevance_score: hit.raw_similarity ?? 0.0,
      matched_keywords: hit.tags ?? [],
    };
  }
}
```

**文件 2:** `apps/desktop/src/main/services/context-envelope-builder.ts`（修改）

**修改内容:**

将 `StubStoreKnowledgeRetrieval` 替换为 `RpcStoreKnowledgeRetrieval`:

```typescript
// Before
const knowledgeRetrieval = new StubStoreKnowledgeRetrieval();

// After
const knowledgeRetrieval = new RpcStoreKnowledgeRetrieval({ rpcClient });
```

#### 验收标准

- [ ] **AC-4.1:** `RpcStoreKnowledgeRetrieval` 实现 `StoreKnowledgeRetrievalPort` 接口
- [ ] **AC-4.2:** 根据场景传递 knowledge_type 和 store_knowledge_type
- [ ] **AC-4.3:** 通过 RPC 调用 Python 侧 RAGEngine
- [ ] **AC-4.4:** 正确转换 RPC 响应为 `StoreKnowledgeQueryResult`
- [ ] **AC-4.5:** Builder 使用 `RpcStoreKnowledgeRetrieval` 替换 stub
- [ ] **AC-4.6:** typecheck 通过
- [ ] **AC-4.7:** 单元测试覆盖 RPC 调用和转换逻辑

#### 测试文件

**文件:** `apps/desktop/tests/rpc-store-knowledge-retrieval.test.ts`（新建）

**测试用例:**

```typescript
test("RpcStoreKnowledgeRetrieval: SHIPPING_TIME scene passes correct filters", async () => {
  const mockRpcClient = { call: jest.fn().mockResolvedValue({ hits: [...] }) };
  const retrieval = new RpcStoreKnowledgeRetrieval({ rpcClient: mockRpcClient });
  
  await retrieval.query("SHIPPING_TIME", { query: "发货时间" });
  
  expect(mockRpcClient.call).toHaveBeenCalledWith("rag.retrieve", {
    query: "发货时间",
    knowledge_type: "STORE_RULE",
    store_knowledge_type: "SHIPPING_TIME",
    top_k: 10,
  });
});

test("RpcStoreKnowledgeRetrieval: converts RPC response correctly", async () => {
  // Test hit → StoreKnowledgeItem conversion
});

test("RpcStoreKnowledgeRetrieval: handles RPC errors gracefully", async () => {
  // Test error handling
});
```

#### 依赖

- 依赖 3.3（TypeScript 侧类型定义）
- 需要 RPC 基础设施（已存在）

---

### 3.5 端到端测试（1.5 天）

#### 目标

验证场景→知识检索→回复生成的完整流程，确保所有场景正确工作。

#### 具体工作

**文件 1:** `services/ai-worker/tests/test_scene_knowledge_routing.py`（新建）

**测试内容:**

```python
"""End-to-end test for scene-based knowledge routing"""

def test_shipping_time_end_to_end():
    """Test SHIPPING_TIME scene retrieves SHIPPING_TIME knowledge"""
    # Setup: Create test database with SHIPPING_TIME knowledge
    # Execute: Call ConversationEngine.generate() with scene="SHIPPING_TIME"
    # Verify: RAGEngine.retrieve() called with correct filters
    # Verify: Response includes SHIPPING_TIME knowledge
    
def test_return_policy_end_to_end():
    """Test RETURN_POLICY scene retrieves RETURN_POLICY knowledge"""
    # Similar to above
    
def test_product_inquiry_end_to_end():
    """Test PRODUCT_INQUIRY scene retrieves PRODUCT_KNOWLEDGE"""
    # Similar to above
    
def test_no_scene_retrieves_all():
    """Test no scene retrieves all knowledge types"""
    # Execute: Call generate() without scene
    # Verify: RAGEngine.retrieve() called without filters
    # Verify: Response includes multiple knowledge types
    
def test_backward_compatibility():
    """Test existing functionality not broken"""
    # Execute: Call generate() with old-style request
    # Verify: Works as before
```

**文件 2:** `apps/desktop/tests/context-envelope-knowledge-integration.test.ts`（新建）

**测试内容:**

```typescript
/**
 * Integration test for ContextEnvelope Builder with real knowledge retrieval
 */

test("Builder retrieves SHIPPING_TIME knowledge for SHIPPING_TIME scene", async () => {
  // Setup: Mock RPC client to return SHIPPING_TIME knowledge
  // Execute: Builder.build() with SHIPPING_TIME scene
  // Verify: envelope.retrieved_knowledge contains SHIPPING_TIME items
});

test("Builder retrieves RETURN_POLICY knowledge for RETURN_POLICY scene", async () => {
  // Similar to above
});

test("Builder handles RPC errors gracefully", async () => {
  // Setup: Mock RPC client to throw error
  // Execute: Builder.build()
  // Verify: envelope.retrieved_knowledge is empty, no crash
});

test("Builder retrieves all knowledge types when scene is unknown", async () => {
  // Setup: Mock RPC client to return mixed knowledge
  // Execute: Builder.build() with unknown scene
  // Verify: envelope.retrieved_knowledge contains multiple types
});
```

#### 验收标准

- [ ] **AC-5.1:** SHIPPING_TIME 端到端测试通过
- [ ] **AC-5.2:** RETURN_POLICY 端到端测试通过
- [ ] **AC-5.3:** PRODUCT_INQUIRY 端到端测试通过
- [ ] **AC-5.4:** 无场景时检索所有类型测试通过
- [ ] **AC-5.5:** 向后兼容测试通过
- [ ] **AC-5.6:** Builder 集成测试通过
- [ ] **AC-5.7:** 错误处理测试通过
- [ ] **AC-5.8:** 所有测试在个人电脑上可以运行

#### 依赖

- 依赖 3.1, 3.2, 3.3, 3.4 全部完成

---

## 三、任务依赖图

```
3.1 场景→知识类型映射（0.5 天）
    ↓
3.2 ConversationEngine 集成（1 天）
    ↓
3.3 TypeScript 类型对齐（0.5 天）← 可与 3.1 并行
    ↓
3.4 Builder 集成真实检索（1.5 天）
    ↓
3.5 端到端测试（1.5 天）
```

---

## 四、风险与缓解

### 风险 1: RPC 调用失败

**可能性:** 中

**影响:** Builder 无法获取知识

**缓解:**
- 错误处理：RPC 失败时返回空结果，不阻塞 Builder
- 降级策略：可以 fallback 到 stub 实现
- 监控：记录 RPC 失败日志

### 风险 2: 场景识别不准确

**可能性:** 低

**影响:** 检索到错误的知识类型

**缓解:**
- 默认映射：未知场景检索所有类型
- 可配置：映射表可以动态调整
- 测试：覆盖所有已知场景

### 风险 3: 向后兼容问题

**可能性:** 低

**影响:** 现有功能被破坏

**缓解:**
- 无场景时不传递过滤参数
- 现有测试不被修改
- 新增测试覆盖新场景

---

## 五、Controller Review

**需要 Controller 确认:**

1. 任务分解是否合理？
2. 验收标准是否清晰？
3. 工作量估算是否准确？
4. 是否授权开始执行？

**Review 决策:**
- `PASS` → 开始执行 3.1
- `REPAIR` → 根据反馈修改后重新 review

---

**文档版本:** v1.0
**创建日期:** 2026-09-29
**作者:** Codex (SHEEP-305 执行者)
