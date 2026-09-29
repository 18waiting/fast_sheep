# SHEEP-305 任务定义（修订版）

> **创建日期:** 2026-09-29
> **修订日期:** 2026-09-29（去掉不必要的"产品决策"）
> **状态:** 待 Controller 授权
> **前置任务:** SHEEP-304 ✅ → SHEEP-306 ✅
> **设计文档:** `docs/architecture/RAG_KNOWLEDGE_BASE.md`
> **架构对齐:** DEC-008 (Layered Knowledge Architecture)

---

## 一、任务目标

**完成 RAG Knowledge Base 的场景路由集成**

底层基础设施已经实现（IndexBuilder、RAGEngine、Retriever），但 ConversationEngine 还没有根据场景使用 knowledge_type 过滤功能。

**SHEEP-305 的目标：** 让 ConversationEngine 根据场景传递 knowledge_type/store_knowledge_type 参数，实现场景→知识类型的路由。

---

## 二、现状分析

### ✅ 已实现（不需要再做）

| 功能 | 文件 | 状态 |
|------|------|------|
| IndexBuilder 支持 store_knowledge | `index_builder.py` | ✅ 已完成 |
| StoreKnowledgeAdapter | `store_knowledge_adapter.py` | ✅ 已完成 |
| RAGEngine 支持 knowledge_type 过滤 | `rag_engine.py` | ✅ 已完成 |
| Retriever 支持 knowledge_type + store_knowledge_type | `retriever.py` | ✅ 已完成 |
| 集成测试 | `test_rag_store_knowledge.py` | ✅ 已完成 |
| ConversationEngine 集成 RAGEngine | `conversation_engine.py` | ✅ 已完成 |

### ❌ 还需要做

**ConversationEngine 调用 RAGEngine 时，没有传递 knowledge_type 参数：**

```python
# 当前代码（conversation_engine.py）
retrieval = self.rag_engine.retrieve(
    {"query": question, "product_id": product_id, "order_state": order["order_state"], "top_k": 15}
)
# ❌ 没有 knowledge_type 或 store_knowledge_type 参数
```

---

## 三、任务分解

### 3.1 场景→知识类型映射（Scene-to-Knowledge Mapping）

**目标:** 定义场景到知识类型的映射关系

**具体内容:**
- 定义 `SceneKnowledgeMapping` 配置
- 实现映射查询逻辑

**映射表（来自 RAG_KNOWLEDGE_BASE.md §4）:**

| Scene | Knowledge Type | Store Knowledge Type |
|-------|---------------|---------------------|
| SHIPPING_TIME | STORE_RULE | SHIPPING_TIME |
| RETURN_POLICY | STORE_RULE | RETURN_POLICY |
| PRODUCT_INQUIRY | PRODUCT_KNOWLEDGE | - |
| FAQ | STORE_RULE | FAQ |

**文件:**
- `services/ai-worker/src/fastwork_ai_worker/conversation/scene_knowledge_mapping.py`（新建）

**验收标准:**
- [ ] 映射配置可查询
- [ ] 支持默认映射（fallback）
- [ ] 单元测试通过

**工作量:** 0.5 天

---

### 3.2 ConversationEngine 集成场景路由

**目标:** ConversationEngine 根据场景传递 knowledge_type/store_knowledge_type 参数

**具体内容:**
- 在 `generate()` 方法中获取场景
- 根据场景查询映射
- 传递 knowledge_type/store_knowledge_type 给 RAGEngine

**文件:**
- `services/ai-worker/src/fastwork_ai_worker/conversation/conversation_engine.py`（修改）

**验收标准:**
- [ ] SHIPPING_TIME 场景检索 STORE_RULE + SHIPPING_TIME
- [ ] RETURN_POLICY 场景检索 STORE_RULE + RETURN_POLICY
- [ ] PRODUCT_INQUIRY 场景检索 PRODUCT_KNOWLEDGE
- [ ] 默认场景检索所有类型（向后兼容）
- [ ] 单元测试通过

**工作量:** 1 天

---

### 3.3 TypeScript 侧类型定义对齐

**目标:** TypeScript 侧定义与 Python 侧对齐的知识类型

**具体内容:**
- 定义 `KnowledgeType` 类型
- 定义 `StoreKnowledgeType` 类型
- 定义场景→知识类型映射

**文件:**
- `packages/domain/src/knowledge.ts`（新建或更新）

**验收标准:**
- [ ] 类型定义与 Python 侧一致
- [ ] typecheck 通过

**工作量:** 0.5 天

---

### 3.4 SHEEP-306 Builder 集成真实知识检索

**目标:** 替换 SHEEP-306 的 stub 知识检索为真实实现

**具体内容:**
- 替换 `StubStoreKnowledgeRetrieval` 为真实实现
- 通过 RPC 调用 Python 侧的 RAGEngine
- 传递场景参数

**文件:**
- `apps/desktop/src/main/adapters/rpc-store-knowledge-retrieval.ts`（修改）
- `apps/desktop/src/main/services/context-envelope-builder.ts`（修改）

**验收标准:**
- [ ] Builder 使用真实知识检索
- [ ] 场景参数正确传递
- [ ] typecheck 通过
- [ ] 集成测试通过

**工作量:** 1.5 天

---

### 3.5 端到端测试

**目标:** 验证场景→知识检索→回复生成的完整流程

**具体内容:**
- 测试 SHIPPING_TIME 场景
- 测试 RETURN_POLICY 场景
- 测试 PRODUCT_INQUIRY 场景
- 测试默认场景

**文件:**
- `services/ai-worker/tests/test_scene_knowledge_routing.py`（新建）
- `apps/desktop/tests/context-envelope-knowledge-integration.test.ts`（新建）

**验收标准:**
- [ ] 所有场景测试通过
- [ ] 知识类型过滤正确
- [ ] 向后兼容（无场景时检索所有类型）

**工作量:** 1.5 天

---

**总计: 5 天**

---

## 四、与之前任务定义的对比

### 之前的任务定义（过度设计）

- ❌ 知识类型注册器（Type Registry）— 已经实现
- ❌ 统一检索接口（Unified Retrieval Interface）— 已经实现
- ❌ 场景路由基础设施（Scene Routing Infrastructure）— 部分实现
- ❌ TypeScript 域类型定义 — 部分实现
- ❌ 集成测试框架 — 已经实现
- ❌ **"产品决策"阻塞** — 不存在

### 修订后的任务定义（基于现状）

- ✅ 场景→知识类型映射（0.5 天）
- ✅ ConversationEngine 集成场景路由（1 天）
- ✅ TypeScript 侧类型定义对齐（0.5 天）
- ✅ SHEEP-306 Builder 集成真实知识检索（1.5 天）
- ✅ 端到端测试（1.5 天）

**总计: 5 天（之前是 9+ 天）**

---

## 五、执行顺序

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

## 六、验收标准

### 功能验收

- [ ] SHIPPING_TIME 场景正确检索 SHIPPING_TIME 知识
- [ ] RETURN_POLICY 场景正确检索 RETURN_POLICY 知识
- [ ] PRODUCT_INQUIRY 场景正确检索 PRODUCT_KNOWLEDGE
- [ ] 默认场景检索所有类型（向后兼容）
- [ ] SHEEP-306 Builder 使用真实知识检索

### 技术验收

- [ ] Python 侧测试通过
- [ ] TypeScript 侧 typecheck 通过
- [ ] 端到端测试通过
- [ ] 代码 review 通过

---

## 七、与 SHEEP-306 的关系

### SHEEP-306 已完成的知识基础设施

**Builder 中的知识检索:**
- `StoreKnowledgeRetrievalPort` — 店铺知识检索端口
- `StubStoreKnowledgeRetrieval` — Stub 实现（返回假数据）

### SHEEP-305 要做的

- 替换 Stub 为真实实现（通过 RPC 调用 Python 侧 RAGEngine）
- 传递场景参数，实现场景→知识类型路由

### 接口兼容性

**当前接口（SHEEP-306）:**
```typescript
interface StoreKnowledgeRetrievalPort {
  query(scene: Scene, context: QueryContext): Promise<KnowledgeResult>;
}
```

**SHEEP-305 实现:**
```typescript
class RpcStoreKnowledgeRetrieval implements StoreKnowledgeRetrievalPort {
  async query(scene: Scene, context: QueryContext): Promise<KnowledgeResult> {
    // 根据 scene 查询映射，获取 knowledge_type/store_knowledge_type
    // 通过 RPC 调用 Python 侧 RAGEngine
    // 返回结果
  }
}
```

**兼容性:** 接口不变，只是替换实现

---

## 八、Controller Review

**需要 Controller 确认:**

1. 是否授权开始 SHEEP-305（修订版）？
2. 任务分解是否合理？
3. 工作量估算是否准确？

**Review 决策:**
- `PASS` → 开始 SHEEP-305
- `REPAIR` → 根据反馈修改后重新 review

---

**文档版本:** v2.0（修订版）
**创建日期:** 2026-09-29
**修订日期:** 2026-09-29
**作者:** Codex (SHEEP-305 执行者)
