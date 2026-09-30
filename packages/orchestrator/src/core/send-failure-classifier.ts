// SHEEP-310: Send Failure Classifier
// 分类发送失败类型，决定是否允许重试

import type { SendAttempt } from "../ports/platform-adapter.js";

/**
 * 发送失败类型
 */
export type SendFailureType =
  | "SAFE_PRE_ATTEMPT"        // 消息未发送（网络错误、超时等）- 允许重试
  | "ATTEMPTED_UNKNOWN"       // 消息可能已发送但状态未知 - 禁止重试
  | "SIDE_EFFECT_POSSIBLE"    // 可能有副作用（部分发送、平台已接收等）- 禁止重试
  | "EXPLICIT_REJECTED";      // 平台明确拒绝 - 禁止重试

/**
 * 发送失败分类结果
 */
export interface SendFailureClassification {
  readonly failureType: SendFailureType;
  readonly retryAllowed: boolean;
  readonly reason: string;
  readonly error?: Error;
}

/**
 * 发送失败分类器
 * 
 * 根据 SendAttempt 的结果分类失败类型，决定是否允许重试。
 * 
 * 分类规则：
 * - SAFE_PRE_ATTEMPT: 消息未发送（网络错误、发送前超时）→ 允许重试
 * - ATTEMPTED_UNKNOWN: 消息可能已发送但状态未知 → 禁止重试
 * - SIDE_EFFECT_POSSIBLE: 可能有副作用（部分发送）→ 禁止重试
 * - EXPLICIT_REJECTED: 平台明确拒绝 → 禁止重试
 */
export class SendFailureClassifier {
  /**
   * 分类发送失败
   * 
   * @param attempt - 发送尝试结果
   * @returns 失败分类结果
   */
  classify(attempt: SendAttempt): SendFailureClassification {
    // 如果发送成功，不需要分类
    if (attempt.ok) {
      return {
        failureType: "SAFE_PRE_ATTEMPT", // 不会用到，但需要返回值
        retryAllowed: false,
        reason: "Send succeeded, no failure to classify",
      };
    }

    // 发送失败，根据错误类型分类
    const error = this.normalizeError(attempt.error);
    const errorMessage = error.message.toLowerCase();

    // 1. 检查是否有 messageId（表明消息可能已发送）
    if (attempt.messageId) {
      // 有 messageId 但发送失败，说明消息可能已发送但状态未知
      return {
        failureType: "ATTEMPTED_UNKNOWN",
        retryAllowed: false,
        reason: "Message ID present but send failed - message may have been sent",
        error,
      };
    }

    // 2. 检查是否是明确的平台拒绝
    if (this.isExplicitRejection(errorMessage)) {
      return {
        failureType: "EXPLICIT_REJECTED",
        retryAllowed: false,
        reason: "Platform explicitly rejected the message",
        error,
      };
    }

    // 3. 检查是否可能有副作用（部分发送）
    if (this.isSideEffectPossible(errorMessage)) {
      return {
        failureType: "SIDE_EFFECT_POSSIBLE",
        retryAllowed: false,
        reason: "Send may have partial side effects",
        error,
      };
    }

    // 4. 检查是否是安全的预发送失败（网络错误、发送前超时）
    if (this.isSafePreAttempt(errorMessage)) {
      return {
        failureType: "SAFE_PRE_ATTEMPT",
        retryAllowed: true,
        reason: "Safe pre-attempt failure - message was not sent",
        error,
      };
    }

    // 5. 默认分类为 ATTEMPTED_UNKNOWN（保守策略）
    return {
      failureType: "ATTEMPTED_UNKNOWN",
      retryAllowed: false,
      reason: "Unknown failure type - conservative classification",
      error,
    };
  }

  /**
   * 标准化错误对象
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    if (typeof error === "string") {
      return new Error(error);
    }
    if (error && typeof error === "object" && "message" in error) {
      return new Error(String(error.message));
    }
    return new Error("Unknown error");
  }

  /**
   * 检查是否是明确的平台拒绝
   */
  private isExplicitRejection(errorMessage: string): boolean {
    const rejectionKeywords = [
      "rejected",
      "refused",
      "denied",
      "forbidden",
      "not allowed",
      "permission denied",
      "unauthorized",
      "blocked by platform",
      "rate limit",
      "quota exceeded",
    ];
    return rejectionKeywords.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * 检查是否可能有副作用
   */
  private isSideEffectPossible(errorMessage: string): boolean {
    const sideEffectKeywords = [
      "partial",
      "incomplete",
      "timeout during send",
      "interrupted",
      "connection lost during",
      "send interrupted",
    ];
    return sideEffectKeywords.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * 检查是否是安全的预发送失败
   */
  private isSafePreAttempt(errorMessage: string): boolean {
    const safeKeywords = [
      "network error",
      "connection refused",
      "dns error",
      "timeout before send",
      "failed to connect",
      "socket hang up",
      "econnrefused",
      "enotfound",
      "etimedout",
    ];
    return safeKeywords.some(keyword => errorMessage.includes(keyword));
  }
}
