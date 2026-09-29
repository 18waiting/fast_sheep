# SHEEP-307 任务定义：AI Worker Structured ReplyPlan Integration

**任务 ID:** SHEEP-307  
**状态:** NOT_STARTED  
**优先级:** P1  
**依赖:** SHEEP-306 ✅, SHEEP-305 ✅  
**工作量估算:** 5-7 天  
**日期:** 2026-09-29

---

## 一、任务目标

让 AI Worker 接收结构化的 ContextEnvelope 作为输入，返回结构化的 ReplyPlan 作为输出，确保 AI 输出是 proposal-only，不能直接执行。

---

## 二、治理依据

- **Master §5:** AI output must be structured and governed
- **DEC-SHEEP-306:** ReplyPlan is the canonical AI output format
- **REPLY_AND_ACTION_SAFETY:** AI confidence alone never grants execution permission
- **Roadmap V1.1 SHEEP-307:** Adapt AI Worker request/response boundary

---

## 三、当前状态（AS-IS）

### 输入：扁平 request dict
```python
{
  "question": "什么时候发货",
  "product_id": "123",
  "order_state": "已下单",
  "chat_history": [...],
  "buyer": "...",
  "shop_id": "...",
  ...
}
```

### 输出：扁平 result dict
```python
{
  "reply": "我们会在48小时内发货",
  "fast_return": False,
  "trace": [...],
  "decision": {...},
  "segments": 3,
  "events": [...]
}
```

### 问题
1. ❌ 没有使用 ContextEnvelope（identity-scoped context）
2. ❌ 没有返回 ReplyPlan（structured plan）
3. ❌ AI 输出可以直接执行（缺少 verification requirements）
4. ❌ Facts, knowledge, inference 没有结构化区分

---

## 四、目标状态（TO-BE）

### 输入：ContextEnvelope
```python
{
  "envelope_id": "...",
  "conversation_id": "...",
  "identity_lock": {
    "merchant_id": "...",
    "store_id": "...",
    "platform": "pdd",
    "customer_identity": {...},
    ...
  },
  "scene": "SHIPPING_TIME",
  "trigger_message": {...},
  "authoritative_facts": {...},
  "retrieved_knowledge": [...],
  "explicit_unknowns": [...]
}
```

### 输出：ReplyPlan
```python
{
  "plan_id": "...",
  "envelope_ref": "...",
  "identity_lock": {...},  # inherited from envelope
  "scene": "SHIPPING_TIME",  # inherited from envelope
  "trigger_message": {...},  # inherited from envelope
  "reply_content": {
    "text": "我们会在48小时内发货",
    "language": "zh-CN",
    "segments": [...]
  },
  "fact_references": [
    {"fact_id": "...", "fact_key": "shop_facts.shipping_policy", ...}
  ],
  "knowledge_references": [
    {"knowledge_id": "...", "knowledge_type": "STORE_RULE", ...}
  ],
  "inference_references": [...],
  "policy_metadata": {
    "rollout_mode": "AUTO",
    "requires_confirmation": False,
    ...
  },
  "verification_requirements": {
    "identity_lock_valid": True,
    "facts_validated": True,
    "required_verifications": [...]
  },
  "unknowns": [...],
  "created_at": "..."
}
```

### 收益
1. ✅ AI 输出是 plan，不是执行授权
2. ✅ IdentityLock 贯穿整个流程
3. ✅ Facts, knowledge, inference 结构化区分
4. ✅ Verification requirements 明确
5. ✅ Policy metadata 治理执行路径

---

## 五、允许范围（Allowed Scope）

### ✅ 允许
- Main/Worker integration
- Schema 定义和验证
- ConversationEngine 修改（接收 ContextEnvelope，返回 ReplyPlan）
- Deterministic provider tests
- Structured-plan tests

### ❌ 禁止
- 发送消息（no send）
- 授予执行授权（no execution authority）
- 修改 Orchestrator（P1-6f 的职责）
- 实现 Policy Engine（SHEEP-308 的职责）

---

## 六、退出标准（Exit Criteria）

- [ ] Worker 接收 identity-scoped context (ContextEnvelope)
- [ ] Worker 返回 structured ReplyPlan
- [ ] No free-form reply bypasses plan validation
- [ ] Plan remains proposal-only
- [ ] Deterministic test path does not call transport
- [ ] Typecheck 通过
- [ ] 单元测试通过（DEFERRED: 需在个人电脑运行）

---

## 七、客户价值

**Customer value:** AI generates usable, context-aware reply plans.  
**Safety value:** AI output cannot directly execute.

---

## 八、风险和缓解

### 风险 1：向后兼容
- **风险：** 现有代码使用扁平 request/result
- **缓解：** 同时支持旧格式和新格式（渐进式迁移）
- **状态：** CONFIRMED

### 风险 2：ContextEnvelope 构建
- **风险：** Main 侧需要先构建 ContextEnvelope
- **缓解：** SHEEP-306 已完成 ContextEnvelopeBuilder
- **状态：** CONFIRMED

### 风险 3：ReplyPlan 构建
- **风险：** Worker 侧需要构建 ReplyPlan
- **缓解：** 在 ConversationEngine 中添加 ReplyPlan 构建逻辑
- **状态：** CONFIRMED

---

**文档版本:** v1.0  
**创建日期:** 2026-09-29  
**创建人:** Codex  
**审核状态:** 待 Controller 审核
