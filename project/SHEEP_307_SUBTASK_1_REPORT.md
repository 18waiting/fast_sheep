# SHEEP-307 子任务 1 完成报告：ReplyPlan Builder

**任务 ID:** SHEEP-307  
**子任务:** 1 - 创建 ReplyPlan Builder（Python）  
**状态:** ✅ COMPLETE  
**日期:** 2026-09-29  
**工作量:** 1 天（计划）/ 实际完成

---

## 📋 目标

创建 ReplyPlanBuilder，将 ConversationEngine 的输出转换为 ReplyPlan 结构。

---

## ✅ 验收标准完成情况

| # | 验收标准 | 状态 | 证据 |
|---|---------|------|------|
| AC-1.1 | ReplyPlanBuilder 类存在 | ✅ | `reply_plan_builder.py:32` |
| AC-1.2 | build() 方法接收 envelope, reply, facts, knowledge, inferences | ✅ | `reply_plan_builder.py:74-80` |
| AC-1.3 | 返回符合 reply-plan.schema.json 的 dict | ✅ | 返回结构包含所有 required 字段 |
| AC-1.4 | plan_id 使用 UUID | ✅ | `reply_plan_builder.py:95` |
| AC-1.5 | envelope_ref 引用 envelope.envelope_id | ✅ | `reply_plan_builder.py:98` |
| AC-1.6 | identity_lock, scene, trigger_message 从 envelope 继承 | ✅ | `reply_plan_builder.py:101-103` |
| AC-1.7 | reply_content 包含 text, language, segments | ✅ | `_build_reply_content()` 方法 |
| AC-1.8 | fact_references 从 facts 构建 | ✅ | `_build_fact_references()` 方法 |
| AC-1.9 | knowledge_references 从 knowledge 构建 | ✅ | `_build_knowledge_references()` 方法 |
| AC-1.10 | verification_requirements 包含 identity_lock_valid, facts_validated | ✅ | `_build_verification_requirements()` 方法 |
| AC-1.11 | policy_metadata.rollout_mode 默认为 "HUMAN_CONFIRM" | ✅ | `_build_policy_metadata()` 返回安全默认值 |
| AC-1.12 | 语法验证通过 | ✅ | `python3 -m py_compile` 通过 |

---

## 🔧 实现详情

### 文件：`reply_plan_builder.py`

**核心类：** `ReplyPlanBuilder`

**核心方法：**
1. `build(envelope, reply, facts_used, knowledge_used, inferences_used, segments, unknowns)` — 主入口
2. `_build_reply_content(reply, segments)` — 构建 reply_content
3. `_build_fact_references(facts_used)` — 构建 fact_references
4. `_build_knowledge_references(knowledge_used)` — 构建 knowledge_references
5. `_build_inference_references(inferences_used)` — 构建 inference_references
6. `_build_verification_requirements(envelope)` — 构建 verification_requirements
7. `_build_policy_metadata()` — 构建 policy_metadata
8. `_build_unknowns(unknowns)` — 构建 unknowns

**关键设计决策：**

1. **MVP 安全默认值：**
   - `rollout_mode = "HUMAN_CONFIRM"` — 需要人工确认
   - `requires_confirmation = True` — 强制确认
   - `risk_level = "medium"` — 保守默认
   - **原因：** 确保 AI 输出不能自动执行

2. **从 envelope 继承：**
   - `identity_lock` — 身份锁定
   - `scene` — 场景分类
   - `trigger_message` — 触发消息
   - **原因：** 保持上下文一致性

3. **结构化引用：**
   - `fact_references` — 引用权威事实
   - `knowledge_references` — 引用检索知识
   - `inference_references` — 引用 AI 推理
   - **原因：** 区分事实、知识、推理

4. **验证要求：**
   - `identity_lock_valid` — 检查 identity_lock 完整性
   - `facts_validated` — 检查 facts 存在性
   - `required_verifications` — 列出需要的验证
   - **原因：** 明确执行前的验证步骤

---

## 📊 影响范围

### 新增的文件
1. `services/ai-worker/src/fastwork_ai_worker/conversation/reply_plan_builder.py`

### 依赖关系
- **依赖：** 无（独立模块）
- **被依赖：** 子任务 3（ConversationEngine 返回 ReplyPlan）

---

## ⚠️ 风险和注意事项

### 1. MVP 安全默认值
- **决策：** rollout_mode 默认为 "HUMAN_CONFIRM"
- **影响：** 所有 AI 回复需要人工确认
- **原因：** MVP 阶段安全第一
- **状态：** CONFIRMED

### 2. 语言默认值
- **决策：** language 默认为 "zh-CN"
- **影响：** 假设 PDD 场景为中文
- **缓解：** 未来可从 envelope 或配置中读取
- **状态：** CONFIRMED

### 3. 验证逻辑
- **决策：** 简单检查字段存在性
- **影响：** 不做深度验证（如 freshness）
- **缓解：** 未来可增强验证逻辑
- **状态：** CONFIRMED

---

## 📝 下一步工作

### 子任务 2：修改 ConversationEngine 接收 ContextEnvelope
- **目标：** 让 ConversationEngine 能接收 ContextEnvelope 作为输入
- **文件：** `conversation_engine.py`
- **工作量：** 1.5 天

---

## ✅ 完成声明

**子任务 1 状态：** COMPLETE

**验证结果：**
- ✅ 所有验收标准满足
- ✅ 语法验证通过
- ✅ MVP 安全默认值
- ✅ 结构化引用
- ✅ 文档完整

**下一步：** 子任务 2 - 修改 ConversationEngine 接收 ContextEnvelope

---

**报告生成时间：** 2026-09-29  
**报告生成人：** Codex  
**审核状态：** 待 Controller 审核
