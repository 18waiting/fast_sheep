# DECISION RECORD: SHEEP-305 重新定义

**日期**: 2026-09-24  
**决策类型**: 架构对齐（Architecture Realignment）  
**状态**: OWNER APPROVED  
**影响范围**: SHEEP-305, MVP-A, Phase 9 Knowledge/RAG

---

## 背景

原 SHEEP-305 设计将 SHIPPING_TIME 规则作为独立的 "fact provider"，要求：
- 建立独立的规则契约
- 每个事实有命名的 producer 和 provenance
- 在 MVP-A 阶段锁定发货时间语义

这与项目已锁定的架构决策矛盾：

**DEC-008 (LOCKED)**: 分层知识架构
```
1. System / Platform
2. Merchant
3. Store        ← 发货时间规则应该在这里
4. Product      ← 商品规则应该在这里
5. Conversation Temporary Context
```

**PDD_MVP_V1.md §6 (LOCKED)**: Knowledge V1 定义
```
Authoritative V1 knowledge is:
- Owner-supplied official shop rules
- shop data
- product data
- order/logistics facts
```

**Phase 9 (Roadmap)**: 完整的 Knowledge / RAG / Learning 体系
- M9.2 Ingestion: Store Knowledge, Product Knowledge
- M9.3 Retrieval: Scope Filter, Candidate Retrieval

---

## 问题

原 SHEEP-305 绕过了 DEC-008 定义的知识体系，把发货时间当作系统级确定性规则，而不是 Store Knowledge 的一种。

**后果**:
1. 架构不一致：违反 DEC-008
2. 技术债：Phase 9 需要重构
3. 过早锁定：发货时间规则语义复杂，MVP-A 阶段不适合锁定
4. 阻塞进度：PRODUCT_DECISION_REQUIRED 卡住整个 MVP-A

---

## 决策

**重新定义 SHEEP-305**，使其符合 DEC-008 的分层知识架构：

### 新定义

**目标**: 建立最小版本的知识检索管道，支持 Store Knowledge 的导入和检索

**范围**:
1. 知识 schema（store knowledge 的一种，包含发货时间规则）
2. 简单的导入界面（商家填写文本规则）
3. 简单的检索（关键词匹配 + 模板渲染）
4. AI 可以检索并使用知识生成回复

**不做** (推迟到 Phase 9):
- 完整的向量检索
- 学习模型
- 复杂的冲突解决
- 多版本管理

### 架构对齐

```
MVP-A (SHEEP-305 重新定义)
  └── 最小知识管道（关键词匹配）
  └── Store Knowledge schema（发货时间规则）
  └── 商家配置界面（文本填写）

MVP-B (SHEEP-309)
  └── 用 SHIPPING_TIME 场景验证全链路
  └── AI 检索知识生成回复

Phase 9 (Knowledge/RAG/Learning)
  └── 扩展为完整向量检索
  └── 自动学习模型
  └── 复杂冲突解决
```

---

## 影响分析

### 对 MVP-A 的影响
- SHEEP-305 工作量增加（需要建最小知识管道）
- 但解除 PRODUCT_DECISION_REQUIRED 阻塞
- MVP-B 可以用 SHIPPING_TIME 场景验证

### 对 Phase 9 的影响
- Phase 9 是扩展，不是重构
- 最小版本 → 完整版本
- 关键词匹配 → 向量检索

### 对产品的影响
- 符合 DEC-008 架构
- 符合 PDD_MVP_V1 §6 定义
- MVP-C 有可用的知识
- 不制造技术债

---

## 实施计划

1. **更新 V1.1 Roadmap**: 重新定义 SHEEP-305
2. **更新 PROJECT_STATE.json**: 记录决策变更
3. **实施新 SHEEP-305**: 建立最小知识管道
4. **Phase 9 扩展**: 完整 Knowledge/RAG 体系

---

## Owner 批准

**批准人**: Owner  
**批准日期**: 2026-09-24  
**批准方式**: 明确指令 "选c吧，重新定义"

---

## 治理说明

此决策不修改 DEC-008、PDD_MVP_V1 或 V1.1 Roadmap 的锁定内容，而是**对齐** SHEEP-305 的实现与已锁定的架构决策。

DEC-008 和 PDD_MVP_V1 保持不变。SHEEP-305 的定义更新为符合这些已锁定决策。

