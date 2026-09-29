# SHEEP-307 子任务 2-5 完成报告

**任务 ID:** SHEEP-307  
**子任务:** 2-5 (批量完成)  
**状态:** ✅ COMPLETE  
**日期:** 2026-09-29

---

## 子任务 2: 修改 ConversationEngine 接收 ContextEnvelope ✅

### 修改文件
- `services/ai-worker/src/fastwork_ai_worker/conversation/conversation_engine.py`

### 实现内容
- 新增 `generate_from_envelope(envelope)` 方法
- 从 envelope 提取 question（从 trigger_message.content）
- 从 envelope 提取 identity_lock 字段
- 从 envelope 提取 authoritative_facts
- 从 envelope 提取 retrieved_knowledge
- 从 envelope 提取 explicit_unknowns
- 构建兼容的 request dict 并调用 generate()

### 验收标准
- [x] AC-2.1: generate_from_envelope(envelope) 方法存在
- [x] AC-2.2: 从 envelope 提取 question
- [x] AC-2.3: 从 envelope 提取 identity_lock 字段
- [x] AC-2.4: 从 envelope 提取 authoritative_facts
- [x] AC-2.5: 从 envelope 提取 retrieved_knowledge
- [x] AC-2.6: 从 envelope 提取 explicit_unknowns
- [x] AC-2.7: 内部调用 generate()
- [x] AC-2.8: generate(request) 方法保持不变（向后兼容）
- [x] AC-2.9: 语法验证通过

---

## 子任务 3: 修改 ConversationEngine 返回 ReplyPlan ✅

### 修改文件
- `services/ai-worker/src/fastwork_ai_worker/conversation/conversation_engine.py`

### 实现内容
- 导入 ReplyPlanBuilder
- 在 generate_from_envelope 中调用 ReplyPlanBuilder
- 将 generate() 的结果转换为 ReplyPlan
- 返回包含 plan, trace, fast_return 的 dict

### 验收标准
- [x] AC-3.1: generate_from_envelope() 返回 ReplyPlan dict
- [x] AC-3.2: ReplyPlan 符合 reply-plan.schema.json
- [x] AC-3.3: 包含 plan_id, envelope_ref, identity_lock, scene, trigger_message
- [x] AC-3.4: 包含 reply_content
- [x] AC-3.5: 包含 fact_references
- [x] AC-3.6: 包含 knowledge_references
- [x] AC-3.7: 包含 verification_requirements
- [x] AC-3.8: 包含 policy_metadata（rollout_mode="HUMAN_CONFIRM"）
- [x] AC-3.9: 语法验证通过

---

## 子任务 4: 创建 RPC 方法 conversation.generate_v2 ✅

### 修改文件
- `services/ai-worker/src/fastwork_ai_worker/rpc/methods/conversation.py`

### 实现内容
- 新增 ConversationMethodsV2 类
- 实现 generate_v2(req) 方法
- 验证输入符合 context-envelope.schema.json
- 调用 engine.generate_from_envelope(envelope)
- 验证输出符合 reply-plan.schema.json
- 返回 ReplyPlan

### 验收标准
- [x] AC-4.1: generate_v2(req) 方法存在
- [x] AC-4.2: 注册为 "conversation.generate_v2" RPC 方法
- [x] AC-4.3: 验证输入符合 context-envelope.schema.json
- [x] AC-4.4: 调用 engine.generate_from_envelope(envelope)
- [x] AC-4.5: 验证输出符合 reply-plan.schema.json
- [x] AC-4.6: 返回 ReplyPlan dict
- [x] AC-4.7: 错误处理（ConversationError）
- [x] AC-4.8: 语法验证通过

---

## 子任务 5: Schema 验证和类型对齐 ✅

### 验证内容
- context-envelope.schema.json 完整
- reply-plan.schema.json 完整
- TypeScript ContextEnvelope 类型与 schema 一致
- TypeScript ReplyPlan 类型与 schema 一致
- typecheck 通过

### 验收标准
- [x] AC-5.1: context-envelope.schema.json 完整
- [x] AC-5.2: reply-plan.schema.json 完整
- [x] AC-5.3: TypeScript ContextEnvelope 类型与 schema 一致
- [x] AC-5.4: TypeScript ReplyPlan 类型与 schema 一致
- [x] AC-5.5: typecheck 通过

---

## 整体验证

### Python 语法验证
```bash
✅ reply_plan_builder.py
✅ conversation_engine.py
✅ conversation.py (RPC methods)
```

### TypeScript Typecheck
```bash
✅ packages/domain typecheck: Done
✅ apps/desktop typecheck: Done
✅ 全部通过
```

---

## 下一步

子任务 6: 集成测试和文档（DEFERRED: 需在个人电脑运行测试）

---

**报告生成时间:** 2026-09-29  
**报告生成人:** Codex
