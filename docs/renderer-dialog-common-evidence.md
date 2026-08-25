# Dialog / Common Component Reference Evidence（SHEEP-029）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.2 · 日期：2026-08-26
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；未复制/未修改/未 eval）

## 1. Reference evidence（CONFIRMED / UNKNOWN）

- **CONFIRMED**（SHEEP-022）：reference 唯一明确对话框 = sidebar.js 的**添加店铺模态框**（UI 结构可作 reference）。
- **CONFIRMED**（SHEEP-022）：添加/删除店铺**操作**依赖后端/平台（`店铺API`）→ **DO_NOT_PORT_DIRECTLY**（feature 粒度）。
- **CONFIRMED**（SHEEP-023）：sidebar.js = UI_WITH_BRIDGE + BACKEND_DEPENDENT + AUTH_OR_SELLER_DEPENDENT；
  **direct bridge/API portability = NOT_ESTABLISHED**。
- **UNKNOWN / NOT_EVIDENCED**：模态框精确尺寸/间距/遮罩透明度/动画/关闭交互细节/其它未发现对话框；
  reference **未确认统一 dialog framework**。

## 2. Fast Sheep clean-room dialog helper（独立实现，非 reference 复制）

- `apps/desktop/src/renderer/components/dialog.ts`：最小、可替换的 dialog helper ——
  `renderDialog(host, title)` 构建 `dialog-overlay`（`role="dialog"` + `aria-modal`）+
  `dialog-panel`（`dialog-header`：`dialog-title` + `dialog-close`）+ `dialog-content`；
  返回 `DialogParts` 供消费者使用。
- **接口最小**：无 options 对象、无 slot registry、无生命周期/事件系统；API stability = **NOT_ESTABLISHED**
  （首个真实消费方接入时可按证据调整；非永久 Design System 契约）。
- **关闭按钮仅结构语义**：不实现 Esc close / overlay click close / focus trap / return-focus /
  animation（UNKNOWN/DEFERRED）。
- **样式仅复用既有 `--fs-*` tokens**：无新增遮罩透明度/宽度/padding/shadow/radius 等未证明视觉值或 token；
  `reference_match_status = NOT_ESTABLISHED`。
- 当前**无消费方**：未接入任何现有流程；首个消费方 = 未来 add-shop modal 的 Fast Sheep 化实现
  或其它授权对话框。

## 3. DEFERRED（不扩大 scope）

- 添加店铺模态框业务内容/操作（DO_NOT_PORT_DIRECTLY → 对应 Fast Sheep 平台/后端单元）。
- dialog 交互行为（Esc/overlay/focus/return-focus/animation）：UNKNOWN/DEFERRED。
- reference 对话框视觉参数：保持 UNKNOWN/NOT_EVIDENCED。

## 4. 边界

- 未复制 reference bundle 代码 / 嵌入样式 / token 值；未 eval；未联网；未扩大 scope。
- 无远程 font/icon/image；CSP 保持（`style-src 'self'`、`connect-src 'none'`）；
  `external_network_calls = 0`。
- schema v7 / migrations 不变；无 sync/Outbox；无 Phase 3 redesign。