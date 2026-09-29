# SHEEP-307 执行计划：详细子任务拆解

**任务 ID:** SHEEP-307  
**总工作量:** 5-7 天  
**日期:** 2026-09-29

---

## 子任务总览

```
子任务 1: 创建 ReplyPlan Builder（Python）— 1 天
    ↓
子任务 2: 修改 ConversationEngine 接收 ContextEnvelope — 1.5 天
    ↓
子任务 3: 修改 ConversationEngine 返回 ReplyPlan — 1 天
    ↓
子任务 4: 创建新的 RPC 方法（conversation.generate_v2）— 0.5 天
    ↓
子任务 5: Schema 验证和类型对齐 — 0.5 天
    ↓
子任务 6: 集成测试和文档 — 1 天
```

**关键路径:** 子任务 1 → 2 → 3 → 4  
**总工作量:** 5.5 天

---

## 子任务 1: 创建 ReplyPlan Builder（Python）

**工作量:** 1 天 | **优先级:** P1 | **依赖:** 无

### 目标
创建 ReplyPlanBuilder，将 ConversationEngine 的输出转换为 ReplyPlan 结构。

### 修改文件
- `services/ai-worker/src/fastwork_ai_worker/conversation/reply_plan_builder.py`（新建）

### 实现内容
1. ReplyPlanBuilder 类
2. build(envelope, reply, facts, knowledge, inferences) → ReplyPlan
3. 生成 plan_id, envelope_ref
4. 构建 fact_references, knowledge_references, inference_references
5. 构建 verification_requirements
6. 构建 policy_metadata（MVP: 默认 rollout_mode="HUMAN_CONFIRM"）

### 验收标准
- [ ] **AC-1.1:** ReplyPlanBuilder 类存在
- [ ] **AC-1.2:** build() 方法接收 envelope, reply, facts, knowledge, inferences
- [ ] **AC-1.3:** 返回符合 reply-plan.schema.json 的 dict
- [ ] **AC-1.4:** plan_id 使用 UUID
- [ ] **AC-1.5:** envelope_ref 引用 envelope.envelope_id
- [ ] **AC-1.6:** identity_lock, scene, trigger_message 从 envelope 继承
- [ ] **AC-1.7:** reply_content 包含 text, language, segments
- [ ] **AC-1.8:** fact_references 从 facts 构建
- [ ] **AC-1.9:** knowledge_references 从 knowledge 构建
- [ ] **AC-1.10:** verification_requirements 包含 identity_lock_valid, facts_validated
- [ ] **AC-1.11:** policy_metadata.rollout_mode 默认为 "HUMAN_CONFIRM"（MVP 安全）
- [ ] **AC-1.12:** 语法验证通过

---

## 子任务 2: 修改 ConversationEngine 接收 ContextEnvelope

**工作量:** 1.5 天 | **优先级:** P1 | **依赖:** 无

### 目标
让 ConversationEngine 能接收 ContextEnvelope 作为输入（同时保持向后兼容）。

### 修改文件
- `services/ai-worker/src/fastwork_ai_worker/conversation/conversation_engine.py`

### 实现内容
1. 新增 generate_from_envelope(envelope) 方法
2. 从 envelope 提取 question, product_id, order_state, chat_history 等
3. 从 envelope.identity_lock 提取 merchant_id, store_id, platform 等
4. 从 envelope.authoritative_facts 提取 facts
5. 从 envelope.retrieved_knowledge 提取 knowledge
6. 从 envelope.explicit_unknowns 提取 unknowns
7. 保持 generate(request) 方法不变（向后兼容）

### 验收标准
- [ ] **AC-2.1:** generate_from_envelope(envelope) 方法存在
- [ ] **AC-2.2:** 从 envelope 提取 question（从 trigger_message.content）
- [ ] **AC-2.3:** 从 envelope 提取 identity_lock 字段
- [ ] **AC-2.4:** 从 envelope 提取 authoritative_facts
- [ ] **AC-2.5:** 从 envelope 提取 retrieved_knowledge
- [ ] **AC-2.6:** 从 envelope 提取 explicit_unknowns
- [ ] **AC-2.7:** 内部调用 generate() 或直接执行逻辑
- [ ] **AC-2.8:** generate(request) 方法保持不变（向后兼容）
- [ ] **AC-2.9:** 语法验证通过

---

## 子任务 3: 修改 ConversationEngine 返回 ReplyPlan

**工作量:** 1 天 | **优先级:** P1 | **依赖:** 子任务 1, 2

### 目标
让 generate_from_envelope() 返回 ReplyPlan 而不是扁平 result。

### 修改文件
- `services/ai-worker/src/fastwork_ai_worker/conversation/conversation_engine.py`

### 实现内容
1. generate_from_envelope() 调用 generate() 获取中间结果
2. 使用 ReplyPlanBuilder 将中间结果转换为 ReplyPlan
3. 返回 ReplyPlan dict

### 验收标准
- [ ] **AC-3.1:** generate_from_envelope() 返回 ReplyPlan dict
- [ ] **AC-3.2:** ReplyPlan 符合 reply-plan.schema.json
- [ ] **AC-3.3:** 包含 plan_id, envelope_ref, identity_lock, scene, trigger_message
- [ ] **AC-3.4:** 包含 reply_content
- [ ] **AC-3.5:** 包含 fact_references（从 authoritative_facts 构建）
- [ ] **AC-3.6:** 包含 knowledge_references（从 retrieved_knowledge 构建）
- [ ] **AC-3.7:** 包含 verification_requirements
- [ ] **AC-3.8:** 包含 policy_metadata（rollout_mode="HUMAN_CONFIRM"）
- [ ] **AC-3.9:** 语法验证通过

---

## 子任务 4: 创建新的 RPC 方法（conversation.generate_v2）

**工作量:** 0.5 天 | **优先级:** P1 | **依赖:** 子任务 3

### 目标
创建新的 RPC 方法接收 ContextEnvelope 并返回 ReplyPlan。

### 修改文件
- `services/ai-worker/src/fastwork_ai_worker/rpc/methods/conversation.py`

### 实现内容
1. 新增 generate_v2(req) 方法
2. 验证输入符合 context-envelope.schema.json
3. 调用 engine.generate_from_envelope(envelope)
4. 验证输出符合 reply-plan.schema.json
5. 返回 ReplyPlan

### 验收标准
- [ ] **AC-4.1:** generate_v2(req) 方法存在
- [ ] **AC-4.2:** 注册为 "conversation.generate_v2" RPC 方法
- [ ] **AC-4.3:** 验证输入符合 context-envelope.schema.json
- [ ] **AC-4.4:** 调用 engine.generate_from_envelope(envelope)
- [ ] **AC-4.5:** 验证输出符合 reply-plan.schema.json
- [ ] **AC-4.6:** 返回 ReplyPlan dict
- [ ] **AC-4.7:** 错误处理（ConversationError）
- [ ] **AC-4.8:** 语法验证通过

---

## 子任务 5: Schema 验证和类型对齐

**工作量:** 0.5 天 | **优先级:** P2 | **依赖:** 子任务 4

### 目标
确保 Python 和 TypeScript 侧的 schema 和类型定义一致。

### 修改文件
- 检查 `resources/contracts/schemas/domain/context-envelope.schema.json`
- 检查 `resources/contracts/schemas/domain/reply-plan.schema.json`
- 检查 `packages/domain/src/context-envelope.ts`
- 检查 `packages/domain/src/reply-plan.ts`

### 实现内容
1. 验证 schema 完整性
2. 验证 TypeScript 类型与 schema 一致
3. 添加缺失的字段或类型
4. 运行 typecheck

### 验收标准
- [ ] **AC-5.1:** context-envelope.schema.json 完整
- [ ] **AC-5.2:** reply-plan.schema.json 完整
- [ ] **AC-5.3:** TypeScript ContextEnvelope 类型与 schema 一致
- [ ] **AC-5.4:** TypeScript ReplyPlan 类型与 schema 一致
- [ ] **AC-5.5:** typecheck 通过

---

## 子任务 6: 集成测试和文档

**工作量:** 1 天 | **优先级:** P2 | **依赖:** 子任务 5

### 目标
编写集成测试，验证端到端流程，生成完成报告。

### 修改文件
- `services/ai-worker/tests/test_reply_plan_builder.py`（新建）
- `services/ai-worker/tests/test_conversation_engine_envelope.py`（新建）
- `project/SHEEP_307_COMPLETION_REPORT.md`（新建）

### 实现内容
1. 测试 ReplyPlanBuilder
2. 测试 ConversationEngine.generate_from_envelope()
3. 测试 RPC 方法 conversation.generate_v2
4. 端到端测试：ContextEnvelope → ReplyPlan
5. 生成完成报告

### 验收标准
- [ ] **AC-6.1:** ReplyPlanBuilder 测试覆盖
- [ ] **AC-6.2:** ConversationEngine.generate_from_envelope() 测试覆盖
- [ ] **AC-6.3:** RPC 方法测试覆盖
- [ ] **AC-6.4:** 端到端测试通过
- [ ] **AC-6.5:** 完成报告生成
- [ ] **AC-6.6:** 测试标记为 DEFERRED（需在个人电脑运行）

---

## 执行顺序

```
子任务 1: ReplyPlan Builder（1 天）
    ↓
子任务 2: ConversationEngine 接收 ContextEnvelope（1.5 天）
    ↓
子任务 3: ConversationEngine 返回 ReplyPlan（1 天）← 依赖子任务 1, 2
    ↓
子任务 4: RPC 方法 generate_v2（0.5 天）← 依赖子任务 3
    ↓
子任务 5: Schema 验证（0.5 天）← 可与子任务 4 并行
    ↓
子任务 6: 集成测试（1 天）← 依赖子任务 4, 5
```

**关键路径:** 子任务 1 → 2 → 3 → 4 → 6  
**总工作量:** 5.5 天

---

## 环境约束

- **开发机（macOS）:** Node v20, typecheck only, ❌ 不能运行测试
- **测试机（Windows）:** Node v22+, ✅ 完整测试
- **验证标准:** macOS 上 typecheck 通过 = 代码正确性最高保证
- **测试标记:** 需要测试的任务标记为 `DEFERRED: 需在个人电脑运行`

---

**文档版本:** v1.0  
**创建日期:** 2026-09-29
