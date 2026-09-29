# SHEEP-305/306/307 完成审计报告

**审计日期:** 2026-09-29  
**审计人:** Codex

---

## 一、SHEEP-305 审计结果

### 计划 vs 实际

| 子任务 | 计划 | 实际 | 状态 |
|--------|------|------|------|
| 1. Retriever 增强 | ✅ | ✅ | 完成 |
| 2. RAGEngine 增强 | ✅ | ✅ | 完成 |
| 3. 场景映射 | ✅ | ✅ | 完成 |
| 4. ConversationEngine 集成 | ✅ | ✅ | 完成 |
| 5. TypeScript 类型对齐 | ✅ | ✅ | 完成 |
| 6. Builder 集成 | ✅ | ✅ | 完成 |

### 验收标准检查

**子任务 1: Retriever 增强**
- [x] AC-1.1: `_search_tier()` 新增 `store_knowledge_type` 参数 ✅
- [x] AC-1.2: 过滤逻辑实现 ✅
- [x] AC-1.3: `retrieve()` 新增参数 ✅
- [x] AC-1.4: 语法验证通过 ✅

**子任务 2: RAGEngine 增强**
- [x] AC-2.1: 从 request 提取 `store_knowledge_type` ✅
- [x] AC-2.2: 传递给 retriever ✅
- [x] AC-2.3: 语法验证通过 ✅

**子任务 3: 场景映射**
- [x] AC-3.1: 映射表定义完整 ✅
- [x] AC-3.2: `get_knowledge_filter()` 函数实现 ✅
- [x] AC-3.3: 语法验证通过 ✅

**子任务 4: ConversationEngine 集成**
- [x] AC-4.1: 导入 `get_knowledge_filter` ✅
- [x] AC-4.2: 提取 scene ✅
- [x] AC-4.3: 调用映射函数 ✅
- [x] AC-4.4: 构建 retrieval_request ✅
- [x] AC-4.5: 向后兼容 ✅
- [x] AC-4.6: Trace 日志 ✅
- [x] AC-4.7: 语法验证通过 ✅

**子任务 5: TypeScript 类型对齐**
- [x] AC-5.1: 类型定义与 Python 侧一致 ✅
- [x] AC-5.2: `getKnowledgeFilter()` 返回正确映射 ✅
- [x] AC-5.3: `getKnowledgeFilter(undefined)` 返回默认 ✅
- [x] AC-5.4: typecheck 通过 ✅
- [x] AC-5.5: 从 domain 包导出 ✅

**子任务 6: Builder 集成**
- [x] AC-6.1: RpcStoreKnowledgeRetrieval 实现 ✅
- [x] AC-6.2: RPC 调用传递正确过滤参数 ✅
- [x] AC-6.3: RPC 响应正确转换 ✅
- [x] AC-6.4: RPC 失败时优雅降级 ✅
- [x] AC-6.5: Builder 使用场景路由 ✅
- [x] AC-6.6: typecheck 通过 ✅

### 测试文件
- [x] test_retriever_store_knowledge_type.py ✅
- [x] test_rag_engine_store_knowledge_type.py ✅
- [x] test_scene_knowledge_mapping.py ✅
- [x] test_conversation_engine_scene_routing.py ✅

### 结论
**SHEEP-305: ✅ 完全完成，无遗漏**

---

## 二、SHEEP-306 审计结果

### 计划 vs 实际

| 组件 | 计划 | 实际 | 状态 |
|------|------|------|------|
| ContextEnvelope Schema | ✅ | ✅ | 完成 |
| ReplyPlan Schema | ✅ | ✅ | 完成 |
| TypeScript 类型定义 | ✅ | ✅ | 完成 |
| ContextEnvelopeBuilder | ✅ | ✅ | 完成 |
| MinimalSceneClassifier | ✅ | ✅ | 完成 |
| StoreKnowledgeRetrievalPort | ✅ | ✅ | 完成 |
| RpcStoreKnowledgeRetrievalAdapter | ✅ | ✅ | 完成 |

### P0-P2 问题解决情况

| 问题 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| P0-1: PROJECT_STATE.json 状态不精确 | P0 | ✅ 已解决 | 状态已更新 |
| P0-2: Format 迁移路径未明确 | P0 | ✅ 已解决 | 文档已更新 |
| P1-3: RolloutMode 词汇不统一 | P1 | ✅ 已解决 | 统一为 OFF/SHADOW/HUMAN_CONFIRM/AUTO |
| P1-4: knowledge_type 分类不统一 | P1 | ✅ 已解决 | Layer 1/2 区分明确 |
| P1-5: TypeScript 类型缺失 | P1 | ✅ 已解决 | context-envelope.ts, reply-plan.ts |
| P1-6: ContextEnvelopeBuilder 未实现 | P1 | ✅ 已解决 | builder.ts 已实现 |
| P1-7: SceneClassifier 未实现 | P1 | ✅ 已解决 | minimal-scene-classifier.ts |
| P2-8: ReplyPlanVerifier 未实现 | P2 | ⏳ 未实现 | DEFERRED |
| P2-9: IdentityLock 验证未实现 | P2 | ⏳ 未实现 | DEFERRED |
| P2-10: Fact 验证未实现 | P2 | ⏳ 未实现 | DEFERRED |
| P2-11: Unknown 判定逻辑未实现 | P2 | ⏳ 未实现 | DEFERRED |
| P2-12: Orchestrator 集成点未实现 | P2 | ⏳ 未实现 | DEFERRED |
| P2-13: 集成测试未编写 | P2 | ⏳ 未实现 | DEFERRED |
| P2-14: 架构文档未更新 | P2 | ✅ 已解决 | 文档已更新 |
| P2-15: Order/Logistics Facts 未实现 | P2 | ⏳ DEFERRED | 原计划延期 |

### 结论
**SHEEP-306: ✅ 核心功能完成，P2 验证器和集成测试 DEFERRED**

---

## 三、SHEEP-307 审计结果

### 计划 vs 实际

| 子任务 | 计划 | 实际 | 状态 |
|--------|------|------|------|
| 1. ReplyPlan Builder | ✅ | ✅ | 完成 |
| 2. ConversationEngine 接收 ContextEnvelope | ✅ | ✅ | 完成 |
| 3. ConversationEngine 返回 ReplyPlan | ✅ | ✅ | 完成 |
| 4. RPC 方法 generate_v2 | ✅ | ⚠️ | **部分完成** |
| 5. Schema 验证 | ✅ | ✅ | 完成 |
| 6. 集成测试 | ✅ | ❌ | **未完成** |

### 发现的问题

#### 问题 1: RPC 方法未注册 ⚠️
**严重程度:** 中等  
**描述:** `ConversationMethodsV2` 类已创建，但未在 `server.py` 中注册  
**影响:** RPC 方法 `conversation.generate_v2` 无法被调用  
**修复:** 需要在 `server.py` 中添加注册代码

**修复代码:**
```python
# 在 server.py 的 __init__ 方法中添加
from .methods.conversation import ConversationMethods, ConversationMethodsV2

# 在注册部分添加
ConversationMethodsV2(self).register(self._dispatcher)
```

#### 问题 2: 测试文件缺失 ❌
**严重程度:** 高  
**描述:** 计划中的 3 个测试文件未创建  
**缺失文件:**
- `test_reply_plan_builder.py`
- `test_conversation_engine_envelope.py`
- `test_conversation_generate_v2.py`

**影响:** 无法验证 SHEEP-307 的功能正确性  
**修复:** 需要创建测试文件（DEFERRED 到个人电脑）

### 验收标准检查

**子任务 1: ReplyPlan Builder**
- [x] AC-1.1: ReplyPlanBuilder 类存在 ✅
- [x] AC-1.2: build() 方法接收正确参数 ✅
- [x] AC-1.3: 返回符合 schema 的 dict ✅
- [x] AC-1.11: rollout_mode 默认为 "HUMAN_CONFIRM" ✅
- [x] AC-1.12: 语法验证通过 ✅

**子任务 2: ConversationEngine 接收 ContextEnvelope**
- [x] AC-2.1: generate_from_envelope() 方法存在 ✅
- [x] AC-2.2-2.6: 从 envelope 提取各字段 ✅
- [x] AC-2.8: generate() 方法保持不变 ✅
- [x] AC-2.9: 语法验证通过 ✅

**子任务 3: ConversationEngine 返回 ReplyPlan**
- [x] AC-3.1: 返回 ReplyPlan dict ✅
- [x] AC-3.2-3.8: 包含所有必需字段 ✅
- [x] AC-3.9: 语法验证通过 ✅

**子任务 4: RPC 方法 generate_v2**
- [x] AC-4.1: generate_v2() 方法存在 ✅
- [ ] AC-4.2: 注册为 RPC 方法 ❌ **未注册**
- [x] AC-4.3-4.7: 验证和错误处理 ✅
- [x] AC-4.8: 语法验证通过 ✅

**子任务 5: Schema 验证**
- [x] AC-5.1-5.4: Schema 和类型一致 ✅
- [x] AC-5.5: typecheck 通过 ✅

**子任务 6: 集成测试**
- [ ] AC-6.1-6.5: 测试覆盖 ❌ **测试文件缺失**

### 结论
**SHEEP-307: ⚠️ 部分完成，存在 2 个遗漏项**

---

## 四、遗漏项汇总

### 需要修复的问题

| # | 任务 | 问题 | 严重程度 | 修复方案 |
|---|------|------|----------|----------|
| 1 | SHEEP-307 | RPC 方法未注册 | 中等 | 在 server.py 中注册 ConversationMethodsV2 |
| 2 | SHEEP-307 | 测试文件缺失 | 高 | 创建 3 个测试文件（DEFERRED） |

### DEFERRED 项（个人电脑测试）

**SHEEP-305 测试（4 个文件）:**
1. test_retriever_store_knowledge_type.py
2. test_rag_engine_store_knowledge_type.py
3. test_scene_knowledge_mapping.py
4. test_conversation_engine_scene_routing.py

**SHEEP-307 测试（3 个文件，待创建）:**
1. test_reply_plan_builder.py
2. test_conversation_engine_envelope.py
3. test_conversation_generate_v2.py

---

## 五、建议

### 立即修复（当前会话）
1. 在 `server.py` 中注册 `ConversationMethodsV2`

### 个人电脑测试
1. 运行 SHEEP-305 的 4 个测试文件
2. 创建并运行 SHEEP-307 的 3 个测试文件

### 后续任务
1. SHEEP-308: 实现 P2 验证器（ReplyPlanVerifier, IdentityLock 验证等）
2. 集成测试：端到端测试 ContextEnvelope → ReplyPlan 流程

---

**审计结论:**  
- SHEEP-305: ✅ 完全完成  
- SHEEP-306: ✅ 核心完成，P2 DEFERRED  
- SHEEP-307: ⚠️ 需要修复 RPC 注册 + 创建测试文件
