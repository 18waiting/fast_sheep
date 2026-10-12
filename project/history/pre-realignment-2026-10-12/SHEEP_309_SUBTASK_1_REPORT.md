# SHEEP-309 子任务 1 完成报告：数据库迁移

**子任务 ID:** SHEEP-309-ST1  
**状态:** ✅ COMPLETE  
**日期:** 2026-09-30  
**工作量:** 0.5 天（实际）

---

## 一、任务目标

创建 SHADOW 审计所需的数据库表结构，支持端到端流水线的审计持久化。

---

## 二、交付物

### 2.1 新建文件

**文件路径:** `resources/persistence/migrations/0009_shadow_audit.sql`

**内容:**
- 3 张审计表（shadow_audit_runs, shadow_audit_steps, shadow_audit_events）
- 10 个索引（优化查询性能）
- CHECK 约束（确保数据完整性）
- 详细注释（步骤说明和治理依据）

### 2.2 表结构

#### shadow_audit_runs（审计运行表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | UUID |
| started_at | TEXT NOT NULL | ISO 8601 开始时间 |
| completed_at | TEXT | ISO 8601 完成时间 |
| status | TEXT NOT NULL | RUNNING/COMPLETED/FAILED |
| shop_id | TEXT NOT NULL | 受控店铺 ID |
| merchant_id | TEXT NOT NULL | 商户 ID |
| total_messages | INTEGER DEFAULT 0 | 处理的消息总数 |
| transport_send_calls | INTEGER DEFAULT 0 | **关键安全指标：必须 = 0** |
| error_summary | TEXT | JSON 错误摘要 |

#### shadow_audit_steps（审计步骤表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | UUID |
| run_id | TEXT NOT NULL | 父运行 ID |
| step_order | INTEGER NOT NULL | 步骤顺序 (1-11) |
| step_name | TEXT NOT NULL | 步骤名称 |
| status | TEXT NOT NULL | PENDING/SUCCESS/FAILED/SKIPPED |
| started_at | TEXT | ISO 8601 开始时间 |
| completed_at | TEXT | ISO 8601 完成时间 |
| input_summary | TEXT | JSON 输入摘要 |
| output_summary | TEXT | JSON 输出摘要 |
| error_detail | TEXT | JSON 错误详情 |
| duration_ms | INTEGER | 执行耗时（毫秒） |

#### shadow_audit_events（审计事件表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | UUID |
| run_id | TEXT NOT NULL | 父运行 ID |
| step_id | TEXT | 父步骤 ID（可选） |
| event_type | TEXT NOT NULL | 事件类型 |
| event_data | TEXT NOT NULL | JSON 事件数据 |
| created_at | TEXT NOT NULL | ISO 8601 创建时间 |

---

## 三、验收标准检查结果

### ✅ AC1: SQL 文件语法正确
- **检查方法:** `sqlite3 :memory: < 0009_shadow_audit.sql`
- **结果:** ✅ 通过

### ✅ AC2: 三张表全部创建成功
- **检查方法:** `.tables` 命令
- **结果:** ✅ shadow_audit_runs, shadow_audit_steps, shadow_audit_events 全部存在

### ✅ AC3: CHECK 约束正确
- **检查方法:** 插入有效值（RUNNING）和无效值（INVALID）
- **结果:** ✅ 有效值接受，无效值拒绝

### ✅ AC4: 索引全部创建成功
- **检查方法:** `.schema` 命令查看索引定义
- **结果:** ✅ 10 个索引全部创建

### ✅ AC5: 0001-0008 迁移未被修改
- **检查方法:** `git diff` 检查 8 个文件
- **结果:** ✅ 所有文件未修改

### ✅ AC6: 迁移是幂等的
- **检查方法:** 连续执行两次迁移
- **结果:** ✅ 第二次执行不报错（IF NOT EXISTS）

---

## 四、11 步流水线步骤定义

迁移文件中定义了 11 个步骤的名称和顺序：

| 步骤 | 名称 | 说明 | 依赖任务 |
|------|------|------|---------|
| 1 | IDENTITY_LOCK | 验证 IdentityLock | SHEEP-300 |
| 2 | PERSISTENCE | 持久化标准化消息 | SHEEP-302 |
| 3 | TURN_BUILD | 聚合构建 AI Turn | SHEEP-303 |
| 4 | SCENE_CLASSIFY | 场景分类 | SHEEP-304 |
| 5 | KNOWLEDGE_RETRIEVAL | 知识检索 | SHEEP-305 |
| 6 | ENVELOPE_BUILD | 构建 ContextEnvelope | SHEEP-306 |
| 7 | REPLY_PLAN | AI 生成 ReplyPlan | SHEEP-307 |
| 8 | POLICY_EVAL | 策略评估 | SHEEP-308 |
| 9 | AUDIT_PERSIST | 确认审计持久化完整性 | SHEEP-309 |
| 10 | TRANSPORT_VERIFY | 验证 TRANSPORT SEND CALLS = 0 | SHEEP-309 |
| 11 | RUN_COMPLETE | 标记运行完成 | SHEEP-309 |

---

## 五、设计决策

### D1: 使用 IF NOT EXISTS 保证幂等性
- **原因:** 开发过程中可能多次执行迁移
- **影响:** 无负面影响，符合 SQLite 最佳实践

### D2: 不使用外键约束
- **原因:** 开发阶段可能存在引用不存在的行
- **影响:** 数据完整性由应用层保证

### D3: JSON 字段使用 TEXT 存储
- **原因:** SQLite 惯例，灵活性高
- **影响:** 应用层负责 JSON.stringify/parse

### D4: 所有时间使用 ISO 8601 格式
- **原因:** 跨时区一致性，易于排序和比较
- **影响:** 无负面影响

### D5: transport_send_calls 作为关键安全指标
- **原因:** SHADOW 模式的核心安全保证
- **影响:** 必须在多个层级验证 = 0

---

## 六、风险和缓解

### 风险 1: 审计数据量过大
- **风险等级:** 中
- **缓解措施:** 仅记录关键字段摘要，不记录完整对象
- **状态:** CONFIRMED

### 风险 2: 迁移冲突
- **风险等级:** 低
- **缓解措施:** 使用 IF NOT EXISTS，幂等执行
- **状态:** CONFIRMED

---

## 七、下一步

**子任务 2: AuditLogger 实现**
- 文件: `apps/desktop/src/main/services/audit-logger.ts`
- 端口: `apps/desktop/src/main/ports/audit-logger-port.ts`
- 工作量: 1 天
- 依赖: 子任务 1 ✅

---

## 八、治理合规

### Product Alignment Guard
```text
PRODUCT_ALIGNMENT: ✅ ALIGNED
CURRENT_MVP_RELEVANCE: MVP-B SHADOW — 核心基础设施
CUSTOMER_VALUE: 可审计的 AI 回复质量
SAFETY_IMPACT: 端到端可追溯性
OUT_OF_SCOPE: 不发送任何消息
DECISION: PROCEED
```

### 环境约束
- ✅ 开发环境（macOS）: SQL 语法验证通过
- ⏸️ 测试环境（Windows）: 单元测试 DEFERRED

---

**报告版本:** v1.0  
**创建日期:** 2026-09-30  
**创建人:** Codex  
**审核状态:** 待 Controller 审核
