// SHEEP-310: Wrong-Target Validator
// 预发送验证：确保发送目标正确，防止发错人/发错会话

/**
 * 验证失败详情
 */
export interface WrongTargetFailure {
  readonly field: string;
  readonly reason: string;
  readonly expected?: string;
  readonly actual?: string;
}

/**
 * 验证结果
 */
export interface WrongTargetValidation {
  readonly valid: boolean;
  readonly failures: readonly WrongTargetFailure[];
}

/**
 * 验证上下文 — 发送前的目标信息
 */
export interface WrongTargetValidationContext {
  readonly shopId: string;
  readonly conversationId: string;
  readonly customerUid?: string;
  readonly platformAccountId?: string;
  readonly triggerMessageId?: string;
  readonly sessionId?: string;
  readonly documentVersion?: string;
  /** 期望的 shopId（来自当前受控店铺） */
  readonly expectedShopId?: string;
  /** 期望的 customerUid（来自独立来源，如买家信息） */
  readonly expectedCustomerUid?: string;
  /** 期望的 documentVersion */
  readonly expectedDocumentVersion?: string;
}

/**
 * Wrong-Target Validator
 * 
 * 在发送前验证目标是否正确。核心原则：
 * 1. shopId 必须与当前受控店铺匹配（防止跨店铺执行）
 * 2. conversationId 必须存在且非空
 * 3. customerUid 独立于 conversationId 验证（防止会话ID正确但目标客户错误）
 * 4. 所有提供的字段都必须有效（不提供则跳过该验证）
 * 5. 保守策略：任何可疑情况都拒绝发送
 */
export class WrongTargetValidator {
  /**
   * 验证发送目标
   */
  validate(context: WrongTargetValidationContext): WrongTargetValidation {
    const failures: WrongTargetFailure[] = [];

    // 1. shopId 必须存在
    if (!context.shopId || context.shopId.trim() === "") {
      failures.push({
        field: "shopId",
        reason: "shopId is required and must be non-empty",
      });
    }

    // 2. conversationId 必须存在
    if (!context.conversationId || context.conversationId.trim() === "") {
      failures.push({
        field: "conversationId",
        reason: "conversationId is required and must be non-empty",
      });
    }

    // 3. shopId 必须与期望店铺匹配（跨店铺检查）
    if (context.expectedShopId && context.shopId && context.shopId !== context.expectedShopId) {
      failures.push({
        field: "shopId",
        reason: "shopId does not match the currently controlled shop — cross-shop execution rejected",
        expected: context.expectedShopId,
        actual: context.shopId,
      });
    }

    // 4. customerUid 独立验证（关键：不依赖 conversationId）
    if (context.expectedCustomerUid && context.customerUid) {
      if (context.customerUid !== context.expectedCustomerUid) {
        failures.push({
          field: "customerUid",
          reason: "customerUid mismatch — target customer does not match expected buyer",
          expected: context.expectedCustomerUid,
          actual: context.customerUid,
        });
      }
    }

    // 5. customerUid 格式验证（如果提供）
    if (context.customerUid && context.customerUid.trim() === "") {
      failures.push({
        field: "customerUid",
        reason: "customerUid is provided but empty — ambiguous target",
      });
    }

    // 6. platformAccountId 格式验证（如果提供）
    if (context.platformAccountId !== undefined && context.platformAccountId.trim() === "") {
      failures.push({
        field: "platformAccountId",
        reason: "platformAccountId is provided but empty",
      });
    }

    // 7. triggerMessageId 格式验证（如果提供）
    if (context.triggerMessageId !== undefined && context.triggerMessageId.trim() === "") {
      failures.push({
        field: "triggerMessageId",
        reason: "triggerMessageId is provided but empty — stale selection",
      });
    }

    // 8. sessionId 格式验证（如果提供）
    if (context.sessionId !== undefined && context.sessionId.trim() === "") {
      failures.push({
        field: "sessionId",
        reason: "sessionId is provided but empty",
      });
    }

    // 9. documentVersion 验证（如果提供且期望版本已知）
    if (context.expectedDocumentVersion && context.documentVersion) {
      if (context.documentVersion !== context.expectedDocumentVersion) {
        failures.push({
          field: "documentVersion",
          reason: "documentVersion mismatch — stale document reference",
          expected: context.expectedDocumentVersion,
          actual: context.documentVersion,
        });
      }
    }

    return {
      valid: failures.length === 0,
      failures,
    };
  }
}
