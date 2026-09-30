// SHEEP-310: Binding Validator
// 验证所有绑定关系（shop, platform, conversation, trigger, session, document）

/**
 * 绑定失败详情
 */
export interface BindingFailure {
  readonly binding: string;
  readonly reason: string;
}

/**
 * 绑定验证结果
 */
export interface BindingValidation {
  readonly valid: boolean;
  readonly failures: readonly BindingFailure[];
}

/**
 * 绑定上下文 — 发送前需要验证的所有绑定
 */
export interface BindingContext {
  /** 店铺绑定 */
  readonly shopId: string;
  /** 平台账号绑定 */
  readonly platformAccountId: string;
  /** 会话绑定 */
  readonly conversationId: string;
  /** 触发消息绑定 */
  readonly triggerMessageId: string;
  /** 会话 session 绑定 */
  readonly sessionId: string;
  /** 文档版本绑定 */
  readonly documentVersion: string;
}

/**
 * Binding Validator
 * 
 * 验证发送前的所有绑定关系是否完整且有效。
 * 
 * 6 种绑定：
 * 1. shop — 店铺标识
 * 2. platform — 平台账号
 * 3. conversation — 会话
 * 4. trigger — 触发消息
 * 5. session — 会话 session
 * 6. document — 文档版本
 * 
 * 所有绑定都必须非空且有效。任何一个绑定失败都会阻止发送。
 */
export class BindingValidator {
  /**
   * 验证所有绑定
   */
  validate(context: BindingContext): BindingValidation {
    const failures: BindingFailure[] = [];

    // 1. Shop binding
    if (!context.shopId || context.shopId.trim() === "") {
      failures.push({ binding: "shop", reason: "shopId binding is missing or empty" });
    }

    // 2. Platform binding
    if (!context.platformAccountId || context.platformAccountId.trim() === "") {
      failures.push({ binding: "platform", reason: "platformAccountId binding is missing or empty" });
    }

    // 3. Conversation binding
    if (!context.conversationId || context.conversationId.trim() === "") {
      failures.push({ binding: "conversation", reason: "conversationId binding is missing or empty" });
    }

    // 4. Trigger binding
    if (!context.triggerMessageId || context.triggerMessageId.trim() === "") {
      failures.push({ binding: "trigger", reason: "triggerMessageId binding is missing or empty — cannot determine trigger source" });
    }

    // 5. Session binding
    if (!context.sessionId || context.sessionId.trim() === "") {
      failures.push({ binding: "session", reason: "sessionId binding is missing or empty" });
    }

    // 6. Document binding
    if (!context.documentVersion || context.documentVersion.trim() === "") {
      failures.push({ binding: "document", reason: "documentVersion binding is missing or empty — cannot verify document freshness" });
    }

    return {
      valid: failures.length === 0,
      failures,
    };
  }
}
