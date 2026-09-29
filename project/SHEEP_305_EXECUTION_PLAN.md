# SHEEP-305 执行计划：RAG 场景路由集成

> **任务 ID:** SHEEP-305  
> **任务名称:** RAG Knowledge Base 场景路由集成  
> **创建日期:** 2026-09-29  
> **状态:** 待执行  
> **前置任务:** SHEEP-306 ✅  
> **总工作量:** 5 天  
> **设计文档:** `docs/architecture/RAG_KNOWLEDGE_BASE.md`

---

## 一、任务目标

**让 ConversationEngine 根据对话场景自动路由到正确的知识类型，实现精准知识检索。**

### 具体目标

1. **Retriever 增强:** 支持 store_knowledge_type 过滤（当前只支持 knowledge_type）
2. **RAGEngine 增强:** 传递 store_knowledge_type 参数
3. **场景→知识类型映射:** 根据场景确定检索的知识类型
4. **ConversationEngine 集成:** 在调用 RAGEngine 时传递过滤参数
5. **TypeScript 对齐:** 类型定义与 Python 侧保持一致
6. **Builder 真实检索:** SHEEP-306 Builder 从 stub 切换到真实 RPC 调用

---

## 二、代码现状验证

### ✅ 已实现

| 组件 | 文件 | 状态 | 说明 |
|------|------|------|------|
| IndexBuilder | `rag/index_builder.py` | ✅ | 支持 store_knowledge 索引 |
| RAGEngine.retrieve() | `rag/rag_engine.py:100` | ✅ | 接受 knowledge_type 参数 |
| Retriever.retrieve() | `rag/retriever.py:200` | ✅ | 接受 knowledge_type 参数 |
| Retriever._search_tier() | `rag/retriever.py:150` | ✅ | 按 knowledge_type 过滤 |
| StoreKnowledgeAdapter | `rag/store_knowledge_adapter.py` | ✅ | 转换 store_knowledge 格式 |

### ❌ 待实现

| 组件 | 文件 | 状态 | 说明 |
|------|------|------|------|
| Retriever._search_tier() | `rag/retriever.py:150` | ❌ | **不支持 store_knowledge_type 过滤** |
| RAGEngine.retrieve() | `rag/rag_engine.py:100` | ❌ | **不传递 store_knowledge_type** |
| ConversationEngine | `conversation/conversation_engine.py:107` | ❌ | **不传递任何知识类型过滤** |
| 场景映射 | `conversation/scene_knowledge_mapping.py` | ❌ | **文件不存在** |
| Builder RPC | `adapters/rpc-store-knowledge-retrieval.ts` | ❌ | **使用 stub 实现** |

---

## 三、任务分解（6 个子任务）

### 子任务 1: Retriever 增强 — 支持 store_knowledge_type 过滤

**工作量:** 0.5 天 | **优先级:** P0 | **依赖:** 无

#### 修改文件

`services/ai-worker/src/fastwork_ai_worker/rag/retriever.py`

**修改点 1:** `_search_tier()` 方法签名（约第 150 行）
- 新增参数 `store_knowledge_type: Optional[str] = None`

**修改点 2:** 过滤逻辑（约第 160 行）
- 新增: `if store_knowledge_type and m.get("store_knowledge_type") != store_knowledge_type: continue`

**修改点 3:** `retrieve()` 方法签名（约第 200 行）
- 新增参数 `store_knowledge_type: Optional[str] = None`

**修改点 4:** 调用 `_search_tier()` 时传递参数（约第 205-210 行）
- 所有 3 处调用都传递 `store_knowledge_type`

#### 验收标准

- [ ] **AC-1.1:** `_search_tier()` 接受 `store_knowledge_type` 参数
- [ ] **AC-1.2:** `retrieve()` 接受 `store_knowledge_type` 参数
- [ ] **AC-1.3:** 当 `store_knowledge_type="SHIPPING_TIME"` 时，只返回对应结果
- [ ] **AC-1.4:** 当 `store_knowledge_type=None` 时，不过滤（向后兼容）
- [ ] **AC-1.5:** 单元测试覆盖（DEFERRED: 需在个人电脑运行）

---

### 子任务 2: RAGEngine 增强 — 传递 store_knowledge_type

**工作量:** 0.5 天 | **优先级:** P0 | **依赖:** 子任务 1

#### 修改文件

`services/ai-worker/src/fastwork_ai_worker/rag/rag_engine.py`

**修改点:** `retrieve()` 方法（约第 100 行）
- 从 request 提取 `store_knowledge_type`
- 传递给 `retriever.retrieve()`

#### 验收标准

- [ ] **AC-2.1:** `retrieve()` 从 request 提取 `store_knowledge_type`
- [ ] **AC-2.2:** 传递给 retriever
- [ ] **AC-2.3:** 不包含时默认 None（向后兼容）
- [ ] **AC-2.4:** 单元测试通过

---

### 子任务 3: 场景→知识类型映射

**工作量:** 0.5 天 | **优先级:** P1 | **依赖:** 无（可与子任务 1 并行）

#### 新建文件

`services/ai-worker/src/fastwork_ai_worker/conversation/scene_knowledge_mapping.py`

**映射表:**
```
SHIPPING_TIME → (STORE_RULE, SHIPPING_TIME)
RETURN_POLICY → (STORE_RULE, RETURN_POLICY)
PRODUCT_INQUIRY → (PRODUCT_KNOWLEDGE, None)
FAQ → (STORE_RULE, FAQ)
默认 → (ALL, None)
```

#### 验收标准

- [ ] **AC-3.1:** 文件创建成功，语法正确
- [ ] **AC-3.2:** `get_knowledge_filter("SHIPPING_TIME")` → `("STORE_RULE", "SHIPPING_TIME")`
- [ ] **AC-3.3:** `get_knowledge_filter("RETURN_POLICY")` → `("STORE_RULE", "RETURN_POLICY")`
- [ ] **AC-3.4:** `get_knowledge_filter("PRODUCT_INQUIRY")` → `("PRODUCT_KNOWLEDGE", None)`
- [ ] **AC-3.5:** `get_knowledge_filter("FAQ")` → `("STORE_RULE", "FAQ")`
- [ ] **AC-3.6:** `get_knowledge_filter("UNKNOWN")` → `("ALL", None)`
- [ ] **AC-3.7:** `get_knowledge_filter(None)` → `("ALL", None)`
- [ ] **AC-3.8:** 单元测试覆盖所有场景

---

### 子任务 4: ConversationEngine 集成场景路由

**工作量:** 1 天 | **优先级:** P1 | **依赖:** 子任务 2, 3

#### 修改文件

`services/ai-worker/src/fastwork_ai_worker/conversation/conversation_engine.py`

**修改点 1:** 导入映射模块
**修改点 2:** 修改 `generate()` 方法（约第 107 行）
- 从 request 提取 scene
- 调用 `get_knowledge_filter(scene)` 获取过滤参数
- 构建 retrieval_request 包含过滤参数
- 记录 trace 日志

#### 验收标准

- [ ] **AC-4.1:** 导入 `get_knowledge_filter` 成功
- [ ] **AC-4.2:** 从 request 提取 scene（支持 `scene` 和 `scene_classification.scene`）
- [ ] **AC-4.3:** scene="SHIPPING_TIME" → retrieve 包含 knowledge_type + store_knowledge_type
- [ ] **AC-4.4:** scene=None → retrieve 不包含过滤参数（向后兼容）
- [ ] **AC-4.5:** trace 记录场景路由决策
- [ ] **AC-4.6:** 现有测试不被破坏
- [ ] **AC-4.7:** 新增测试覆盖所有场景

---

### 子任务 5: TypeScript 侧类型定义对齐

**工作量:** 0.5 天 | **优先级:** P2 | **依赖:** 子任务 3

#### 修改文件

`packages/domain/src/knowledge.ts`

- 定义 KnowledgeType, StoreKnowledgeType 类型
- 定义 KnowledgeFilter 接口
- 实现 getKnowledgeFilter() 函数

#### 验收标准

- [ ] **AC-5.1:** 类型定义与 Python 侧一致
- [ ] **AC-5.2:** `getKnowledgeFilter("SHIPPING_TIME")` 返回正确映射
- [ ] **AC-5.3:** `getKnowledgeFilter(undefined)` 返回默认
- [ ] **AC-5.4:** typecheck 通过
- [ ] **AC-5.5:** 从 domain 包导出

---

### 子任务 6: Builder 集成真实知识检索

**工作量:** 1.5 天 | **优先级:** P2 | **依赖:** 子任务 5

#### 修改文件

- `apps/desktop/src/main/adapters/rpc-store-knowledge-retrieval.ts` — 实现 RPC 调用
- `apps/desktop/src/main/services/context-envelope-builder.ts` — 替换 stub 为 RPC

#### 验收标准

- [ ] **AC-6.1:** RpcStoreKnowledgeRetrieval 实现 StoreKnowledgeRetrievalPort
- [ ] **AC-6.2:** RPC 调用传递正确的过滤参数
- [ ] **AC-6.3:** RPC 响应正确转换
- [ ] **AC-6.4:** RPC 失败时优雅降级（返回空结果）
- [ ] **AC-6.5:** Builder 使用 RpcStoreKnowledgeRetrieval
- [ ] **AC-6.6:** typecheck 通过
- [ ] **AC-6.7:** 单元测试通过（DEFERRED: 需在个人电脑运行）

---

## 四、执行顺序

```
子任务 1: Retriever 增强（0.5 天）
    ↓
子任务 2: RAGEngine 增强（0.5 天）
    ↓
子任务 3: 场景映射（0.5 天）← 可与子任务 1 并行
    ↓
子任务 4: ConversationEngine 集成（1 天）← 依赖子任务 2, 3
    ↓
子任务 5: TypeScript 类型对齐（0.5 天）← 可与子任务 4 并行
    ↓
子任务 6: Builder 真实检索（1.5 天）← 依赖子任务 5
```

**关键路径:** 子任务 1 → 2 → 4  
**总工作量:** 5 天

---

## 五、环境约束

- **开发机（macOS）:** Node v20, typecheck only, ❌ 不能运行测试
- **测试机（Windows）:** Node v22+, ✅ 完整测试
- **验证标准:** macOS 上 typecheck 通过 = 代码正确性最高保证
- **测试标记:** 需要测试的任务标记为 `DEFERRED: 需在个人电脑运行`

---

**文档版本:** v2.0  
**创建日期:** 2026-09-29
