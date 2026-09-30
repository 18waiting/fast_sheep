// SHEEP-310: Retry Policy
// 基于 SendFailureClassification 决定是否允许重试
// 核心安全不变量：只有 SAFE_PRE_ATTEMPT 允许重试

import type { SendFailureClassification } from "../core/send-failure-classifier.js";

/**
 * 重试决策
 */
export interface RetryDecision {
  readonly shouldRetry: boolean;
  readonly reason: string;
}

/**
 * Retry Policy
 * 
 * 核心安全不变量：
 * - 只有 SAFE_PRE_ATTEMPT 失败类型允许重试
 * - ATTEMPTED_UNKNOWN、SIDE_EFFECT_POSSIBLE、EXPLICIT_REJECTED 绝不重试
 * - 这是 SHEEP-310 的核心安全属性
 */
export class RetryPolicy {
  /**
   * 基于失败分类决定是否重试
   */
  decide(classification: SendFailureClassification): RetryDecision {
    // 核心安全不变量：只有 SAFE_PRE_ATTEMPT 允许重试
    if (classification.failureType === "SAFE_PRE_ATTEMPT") {
      return {
        shouldRetry: true,
        reason: `Safe pre-attempt failure — message was not sent. ${classification.reason}`,
      };
    }

    // 所有其他失败类型都禁止重试
    return {
      shouldRetry: false,
      reason: `Retry blocked for ${classification.failureType}. ${classification.reason}`,
    };
  }
}
