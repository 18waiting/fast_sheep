/**
 * RolloutMode Resolver (SHEEP-308).
 *
 * Purpose: Resolve the appropriate RolloutMode based on configuration hierarchy
 * and current context.
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - PDD_MVP_V1.md §4: Configuration Hierarchy (GLOBAL -> SHOP -> SCENE).
 * - REPLY_AND_ACTION_SAFETY: Deterministic policy evaluation.
 *
 * Key invariants:
 * - Resolution is deterministic and auditable.
 * - Precedence: SCENE > SHOP > GLOBAL (MVP: SHOP > GLOBAL).
 * - First matching override wins.
 * - Resolution does not modify configuration.
 * - Resolution does not call AI or transport.
 *
 * Owner SHEEP-308 decisions:
 * D1: MVP implements GLOBAL and SHOP levels only.
 * D2: SCENE level is DEFERRED to future work.
 * D3: Overrides are evaluated in order, first match wins.
 */

import type { RolloutMode } from "@fastwork/domain";
import type {
  PolicyConfig,
  RolloutModeConfig,
  RolloutModeOverride,
  OverrideCondition,
} from "@fastwork/domain";

/**
 * ResolutionContext: Context for RolloutMode resolution.
 *
 * Contains the current state needed to evaluate configuration overrides.
 *
 * Usage:
 * ```typescript
 * const context: ResolutionContext = {
 *   shop_id: "shop_123",
 *   scene: "SHIPPING_TIME",
 *   risk_level: "low",
 *   has_blocking_unknowns: false
 * };
 * ```
 */
export interface ResolutionContext {
  /**
   * Shop identifier for shop-level configuration lookup.
   * Required.
   */
  readonly shop_id: string;

  /**
   * Scene name for scene-level configuration lookup.
   * Optional. MVP DEFERRED - not used in v1.
   */
  readonly scene?: string;

  /**
   * Risk level assessed by PolicyEngine.
   * Optional. Used for conditional overrides.
   */
  readonly risk_level?: "low" | "medium" | "high";

  /**
   * Whether blocking unknowns are present.
   * Optional. Used for conditional overrides.
   */
  readonly has_blocking_unknowns?: boolean;
}

/**
 * ResolutionResult: Result of RolloutMode resolution.
 *
 * Contains the resolved mode and metadata about how it was determined.
 *
 * Usage:
 * ```typescript
 * const result: ResolutionResult = {
 *   mode: "HUMAN_CONFIRM",
 *   source: "shop",
 *   shop_id: "shop_123",
 *   override_reason: "High risk scenario"
 * };
 * ```
 */
export interface ResolutionResult {
  /**
   * The resolved RolloutMode.
   */
  readonly mode: RolloutMode;

  /**
   * The source of this resolution result.
   * - "global": from global default
   * - "shop": from shop-level override
   * - "override": from conditional override
   */
  readonly source: "global" | "shop" | "override";

  /**
   * Shop ID if source is "shop" or "override".
   * Optional.
   */
  readonly shop_id?: string;

  /**
   * Reason for the override if source is "override".
   * Optional.
   */
  readonly override_reason?: string;
}

/**
 * RolloutModeResolver: Resolves RolloutMode from configuration and context.
 *
 * This class evaluates the configuration hierarchy and current context
 * to determine the appropriate RolloutMode for a given situation.
 *
 * Usage:
 * ```typescript
 * const config: PolicyConfig = {
 *   global: { default_mode: "HUMAN_CONFIRM" },
 *   shops: {
 *     "shop_123": { default_mode: "SHADOW" }
 *   }
 * };
 *
 * const resolver = new RolloutModeResolver(config);
 * const result = resolver.resolve({
 *   shop_id: "shop_123",
 *   risk_level: "low"
 * });
 *
 * console.log(result.mode); // "SHADOW"
 * console.log(result.source); // "shop"
 * ```
 */
export class RolloutModeResolver {
  /**
   * Create a new RolloutModeResolver.
   *
   * @param config - Policy configuration hierarchy
   */
  constructor(private readonly config: PolicyConfig) {}

  /**
   * Resolve the appropriate RolloutMode for the given context.
   *
   * Resolution order:
   * 1. Check shop-level configuration (if shop_id provided)
   * 2. Evaluate conditional overrides (if any)
   * 3. Fall back to global default
   *
   * @param context - Resolution context (shop_id, scene, risk_level, etc.)
   * @returns ResolutionResult with resolved mode and metadata
   */
  resolve(context: ResolutionContext): ResolutionResult {
    // Step 1: Get shop-level config or fall back to global
    const shopConfig = this.getShopConfig(context.shop_id);
    const configSource = shopConfig ? "shop" : "global";
    const effectiveConfig = shopConfig || this.config.global;

    // Step 2: Evaluate overrides
    if (effectiveConfig.overrides && effectiveConfig.overrides.length > 0) {
      const matchedOverride = this.findMatchingOverride(
        effectiveConfig.overrides,
        context
      );

      if (matchedOverride) {
        return {
          mode: matchedOverride.mode,
          source: "override",
          shop_id: shopConfig ? context.shop_id : undefined,
          override_reason: matchedOverride.reason,
        };
      }
    }

    // Step 3: Return default mode
    return {
      mode: effectiveConfig.default_mode,
      source: configSource as "global" | "shop",
      shop_id: shopConfig ? context.shop_id : undefined,
    };
  }

  /**
   * Get shop-level configuration if it exists.
   *
   * @param shop_id - Shop identifier
   * @returns RolloutModeConfig for the shop, or undefined if not configured
   */
  private getShopConfig(shop_id: string): RolloutModeConfig | undefined {
    return this.config.shops?.[shop_id];
  }

  /**
   * Find the first matching override in the list.
   *
   * @param overrides - List of conditional overrides
   * @param context - Resolution context
   * @returns First matching override, or undefined if none match
   */
  private findMatchingOverride(
    overrides: readonly RolloutModeOverride[],
    context: ResolutionContext
  ): RolloutModeOverride | undefined {
    for (const override of overrides) {
      if (this.conditionMatches(override.condition, context)) {
        return override;
      }
    }
    return undefined;
  }

  /**
   * Check if a condition matches the current context.
   *
   * All specified fields in the condition must match (AND logic).
   * Unspecified fields are ignored (wildcard).
   *
   * @param condition - Override condition to evaluate
   * @param context - Current resolution context
   * @returns true if condition matches, false otherwise
   */
  private conditionMatches(
    condition: OverrideCondition,
    context: ResolutionContext
  ): boolean {
    // Check scene (MVP DEFERRED - not used in v1)
    if (condition.scene !== undefined) {
      if (context.scene !== condition.scene) {
        return false;
      }
    }

    // Check risk_level
    if (condition.risk_level !== undefined) {
      if (context.risk_level !== condition.risk_level) {
        return false;
      }
    }

    // Check has_blocking_unknowns
    if (condition.has_blocking_unknowns !== undefined) {
      const contextHasBlocking = context.has_blocking_unknowns ?? false;
      if (contextHasBlocking !== condition.has_blocking_unknowns) {
        return false;
      }
    }

    // All specified fields matched
    return true;
  }
}

/**
 * Helper function to create a RolloutModeResolver.
 *
 * @param config - Policy configuration hierarchy
 * @returns New RolloutModeResolver instance
 *
 * @example
 * ```typescript
 * const resolver = createRolloutModeResolver(config);
 * const result = resolver.resolve(context);
 * ```
 */
export function createRolloutModeResolver(
  config: PolicyConfig
): RolloutModeResolver {
  return new RolloutModeResolver(config);
}
