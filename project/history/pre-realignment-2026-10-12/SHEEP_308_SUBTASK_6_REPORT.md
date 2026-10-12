# SHEEP-308 子任务 6 完成报告：替换 ReplyPlan 中的硬编码 policy_metadata

**任务ID:** SHEEP-308  
**子任务:** 6/7  
**状态:** ✅ COMPLETE  
**日期:** 2026-09-29

---

## 📋 任务目标

将 ReplyPlanBuilder 中硬编码的 policy_metadata 替换为 PolicyEngine 的评估结果。

---

## ✅ 完成内容

### 修改文件
**文件:** `services/ai-worker/src/fastwork_ai_worker/conversation/reply_plan_builder.py`

### 1. build() 方法签名扩展
```python
def build(
    self,
    envelope: Dict[str, Any],
    reply: str,
    facts_used: Optional[List[Dict[str, Any]]] = None,
    knowledge_used: Optional[List[Dict[str, Any]]] = None,
    inferences_used: Optional[List[Dict[str, Any]]] = None,
    segments: Optional[List[Dict[str, Any]]] = None,
    unknowns: Optional[List[Dict[str, Any]]] = None,
    policy_decision: Optional[Dict[str, Any]] = None,  # SHEEP-308: 新增
) -> Dict[str, Any]:
```

### 2. _build_policy_metadata() 方法重构
```python
def _build_policy_metadata(
    self,
    policy_decision: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    # SHEEP-308: 使用外部 PolicyDecision
    if policy_decision is not None:
        return {
            "rollout_mode": policy_decision.get("rollout_mode", "HUMAN_CONFIRM"),
            "requires_confirmation": policy_decision.get("requires_confirmation", True),
            "policy_version": policy_decision.get("policy_version", "1.0.0"),
            "evaluated_at": policy_decision.get("evaluated_at", ""),
            "source": "policy_engine",  # 标识动态评估
            # ... 包含评估详情（reasons, warnings, blocking_issues）
        }
    
    # 向后兼容：MVP 安全默认值
    return {
        "rollout_mode": "HUMAN_CONFIRM",
        "requires_confirmation": True,
        "confirmation_reason": "MVP: All AI replies require human confirmation",
        "risk_level": "medium",
        "source": "default",  # 标识无外部策略评估
    }
```

---

## 🔑 关键设计决策

### D7: 向后兼容
- `policy_decision` 参数是**可选**的
- 不提供时行为完全不变（默认 HUMAN_CONFIRM）
- 现有调用方无需修改

### D8: 审计信息
- 当使用 PolicyEngine 时，包含完整评估详情
- `source: "policy_engine"` 标识动态评估来源
- `source: "default"` 标识默认来源
- 包含 `reasons`, `warnings`, `blocking_issues` 供审计

### D9: 字段映射
| PolicyDecision 字段 | policy_metadata 字段 |
|---------------------|---------------------|
| rollout_mode | rollout_mode |
| requires_confirmation | requires_confirmation |
| confirmation_reason | confirmation_reason |
| policy_version | policy_version |
| evaluated_at | evaluated_at |
| reasons | evaluation_reasons |
| warnings | evaluation_warnings |
| blocking_issues | blocking_issues |

---

## ✅ 验收标准检查

- [x] **AC-6.1:** ReplyPlanBuilder 接收 policy_decision 参数
- [x] **AC-6.2:** 使用 policy_decision 构建 policy_metadata
- [x] **AC-6.3:** 向后兼容（无 policy_decision 时默认 HUMAN_CONFIRM）
- [x] **AC-6.4:** Python 语法验证通过 ✅
- [x] **AC-6.5:** TypeScript typecheck 通过 ✅
- [x] **AC-6.6:** 包含审计信息（source, reasons, warnings）

---

## 📊 使用示例

### 向后兼容（无 PolicyEngine）
```python
builder = ReplyPlanBuilder()
plan = builder.build(
    envelope=envelope,
    reply="我们会在48小时内发货",
    facts_used=[...],
)
# plan["policy_metadata"]["rollout_mode"] == "HUMAN_CONFIRM"
# plan["policy_metadata"]["source"] == "default"
```

### 使用 PolicyEngine（SHEEP-308）
```python
builder = ReplyPlanBuilder()
plan = builder.build(
    envelope=envelope,
    reply="我们会在48小时内发货",
    facts_used=[...],
    policy_decision={
        "rollout_mode": "SHADOW",
        "requires_confirmation": False,
        "policy_version": "1.0.0",
        "evaluated_at": "2026-09-29T10:00:00Z",
        "reasons": ["IdentityLock validated", "No blocking unknowns"],
        "warnings": [],
        "blocking_issues": [],
    },
)
# plan["policy_metadata"]["rollout_mode"] == "SHADOW"
# plan["policy_metadata"]["source"] == "policy_engine"
```

---

## 🚀 下一步

**子任务 7:** 测试和文档
- 编写测试用例（DEFERRED 到个人电脑）
- 生成完成报告 `SHEEP_308_COMPLETION_REPORT.md`

---

**完成时间:** 2026-09-29  
**验证状态:** ✅ Python 语法 + TypeScript typecheck 通过  
**测试状态:** ⏳ DEFERRED（需要个人电脑）
