"""M9 HandoffPolicyEngine (clean-room). Production implementation behind M5 HandoffDecisionPort.

Derived from spec/ai/handoff-decision-table.md (CONFIRMED HIGH) + GF-HANDOFF fixtures.
Evaluation:
  master gates (enabled, rules loaded, merged text non-empty, not xianyu)
  -> Path 1: literal keyword match, first-match wins in rule order (status + shop gate)
  -> Path 2: special conditions (per-rule gates S1-S5 + pseudo-keywords)
Precedence (early/tool/post) is handled by callers; this engine is the post-generation
decision. Legacy marker is decoded via legacy_marker_codec (compatibility only).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .types import EvaluationContext, HandoffDecision, HandoffRule, TraceEntry
from .keyword_matcher import match_keywords
from .pseudo_keyword_matcher import match_pseudo_keyword
from .target_selector import RandomProvider, select_target
from .platform_policy import is_xianyu_agent, platform_transfer_allowed
from .work_hours import in_work_hours
from .rule_parser import split_keywords


class HandoffPolicyEngine:
    def __init__(self, rng: Optional[RandomProvider] = None):
        self._rng = rng

    def decide(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Evaluate a context dict against loaded rules; returns a HandoffDecision dict.

        The dict uses TransferDecision-compatible fields plus trace/log fields.
        """
        ctx = self._to_context(context)
        rules = self._load_rules(context)
        decision = self._evaluate(ctx, rules)
        return decision.to_dict()

    def _to_context(self, context: Dict[str, Any]) -> EvaluationContext:
        try:
            sim = float(context.get("highest_sim") or context.get("最高相似度") or 0.0)
        except (TypeError, ValueError):
            sim = 0.0
        return EvaluationContext(
            question=str(context.get("question") or context.get("买家问题") or ""),
            ai_reply=str(context.get("ai_reply") or context.get("AI回复") or ""),
            agent=str(context.get("agent") or context.get("当前客服") or ""),
            shop=str(context.get("shop") or context.get("当前店铺") or ""),
            order_state=str(context.get("order_state") or context.get("订单状态") or ""),
            highest_sim=sim,
            time_ms=int(context.get("time_ms") or context.get("clock_ms") or 0),
            platform=str(context.get("platform") or ""),
            enabled=bool(context.get("enabled", True)),
            capabilities=dict(context.get("capabilities") or {}),
        )

    def _load_rules(self, context: Dict[str, Any]) -> List[HandoffRule]:
        rules = context.get("rules")
        if rules is None:
            return []
        from .rule_model import parse_rule
        return [parse_rule(r) for r in rules]

    def _evaluate(self, ctx: EvaluationContext, rules: List[HandoffRule]) -> HandoffDecision:
        trace: List[TraceEntry] = []
        decision = HandoffDecision(trace=trace)

        # Master gates
        if not ctx.enabled:
            trace.append(TraceEntry("master.enabled", "disabled", False))
            return decision
        if not rules:
            trace.append(TraceEntry("master.rules", "empty", False))
            return decision
        if is_xianyu_agent(ctx.agent):
            trace.append(TraceEntry("master.xianyu", "excluded", False))
            decision.reason = "xianyu_excluded"
            return decision
        if not platform_transfer_allowed(ctx.platform, ctx.capabilities):
            trace.append(TraceEntry("master.capability", "blocked", False))
            decision.reason = "capability_gate"
            return decision
        trace.append(TraceEntry("master.gates", "pass", True))

        for rule in rules:
            # Enabled/status gate
            if rule.status != "生效" or not rule.enabled:
                trace.append(TraceEntry("rule.status", rule.keyword, False))
                continue
            if not self._shop_allowed(rule, ctx.shop):
                trace.append(TraceEntry("rule.shop_gate", rule.keyword, False))
                decision.reason = "shop_gate"
                return decision

            if rule.is_pseudo_keyword():
                d = self._eval_pseudo_rule(rule, ctx, trace)
                if d is not None:
                    return d
                continue

            # Path 1: literal keyword match (substring containment, first match wins)
            matched = match_keywords(rule.keyword, ctx.merged_text)
            if matched is not None:
                trace.append(TraceEntry("rule.keyword", matched, True))
                d = self._eval_normal_rule(rule, ctx, matched, trace)
                return d

            # Path 2: normal rule with special fields fires on the special gates
            # (work-hours / source-agent / order-state) per GF-HANDOFF-007/008/009.
            if self._has_special_fields(rule):
                d = self._eval_special_rule(rule, ctx, trace)
                if d is not None:
                    return d
        trace.append(TraceEntry("rule.no_match", "", False))
        return decision

    @staticmethod
    def _has_special_fields(rule: HandoffRule) -> bool:
        return bool(rule.source_agent or rule.work_hours or rule.order_state or rule.applicable_shops)

    def _eval_normal_rule(self, rule: HandoffRule, ctx: EvaluationContext, matched: str, trace: List[TraceEntry]) -> HandoffDecision:
        source_passed = True
        if rule.source_agent:
            if rule.source_agent in ctx.agent:
                trace.append(TraceEntry("rule.source_agent", "contained", True))
            else:
                trace.append(TraceEntry("rule.source_agent", "blocked", False))
                return HandoffDecision(trace=trace)
        wh = in_work_hours(rule.work_hours, ctx.time_ms)
        if wh is False:
            trace.append(TraceEntry("rule.work_hours", "outside", False))
            d = HandoffDecision(trace=trace)
            d.reason = "outside_hours"
            return d
        if rule.order_state:
            allowed = [s.strip() for s in rule.order_state.replace("，", ",").split(",") if s.strip()]
            if ctx.order_state not in allowed:
                trace.append(TraceEntry("rule.order_state", "blocked", False))
                d = HandoffDecision(trace=trace)
                d.reason = "normal_path_order_gate" if rule.source_agent else "order_gate"
                return d
        d = self._build(rule, keyword=matched, trace=trace)
        if rule.source_agent and source_passed:
            d.reason = "source_agent_contained"
        return d

    def _eval_special_rule(self, rule: HandoffRule, ctx: EvaluationContext, trace: List[TraceEntry]) -> Optional[HandoffDecision]:
        if rule.source_agent and rule.source_agent not in ctx.agent:
            trace.append(TraceEntry("rule.special.source_agent", "blocked", False))
            return HandoffDecision(trace=trace)
        wh = in_work_hours(rule.work_hours, ctx.time_ms)
        if wh is False:
            trace.append(TraceEntry("rule.special.work_hours", "outside", False))
            d = HandoffDecision(trace=trace)
            d.reason = "outside_hours"
            return d
        if rule.order_state:
            allowed = [s.strip() for s in rule.order_state.replace("，", ",").split(",") if s.strip()]
            if ctx.order_state not in allowed:
                trace.append(TraceEntry("rule.special.order_state", "blocked", False))
                d = HandoffDecision(trace=trace)
                d.reason = "normal_path_order_gate" if rule.source_agent else "order_gate"
                return d
        if not self._shop_allowed(rule, ctx.shop):
            trace.append(TraceEntry("rule.special.shop_gate", "blocked", False))
            d = HandoffDecision(trace=trace)
            d.reason = "shop_gate"
            return d
        return self._build(rule, keyword=None, trace=trace)

    def _eval_pseudo_rule(self, rule: HandoffRule, ctx: EvaluationContext, trace: List[TraceEntry]) -> Optional[HandoffDecision]:
        # Path 2 special-condition gates S1-S5
        if rule.source_agent and not (rule.source_agent in ctx.agent and ctx.agent in rule.source_agent):
            trace.append(TraceEntry("rule.pseudo.source_agent", "blocked", False))
            return HandoffDecision(trace=trace)
        wh = in_work_hours(rule.work_hours, ctx.time_ms)
        if wh is False:
            trace.append(TraceEntry("rule.pseudo.work_hours", "outside", False))
            return HandoffDecision(trace=trace)
        if rule.order_state:
            allowed = [s.strip() for s in rule.order_state.replace("，", ",").split(",") if s.strip()]
            if ctx.order_state not in allowed:
                trace.append(TraceEntry("rule.pseudo.order_state", "blocked", False))
                return HandoffDecision(trace=trace)
        if not self._shop_allowed(rule, ctx.shop):
            trace.append(TraceEntry("rule.pseudo.shop_gate", "blocked", False))
            return HandoffDecision(trace=trace)

        m = match_pseudo_keyword(rule.keyword, ctx)
        if m is None:
            trace.append(TraceEntry("rule.pseudo.no_match", rule.keyword, False))
            return None
        if m.get("operator") and not m.get("reason"):
            # strict boundary not satisfied: e.g. similarity == 0.6 with <0.6
            trace.append(TraceEntry("rule.pseudo.boundary", rule.keyword, False))
            d = HandoffDecision(trace=trace)
            d.operator = m.get("operator")
            return d
        trace.append(TraceEntry("rule.pseudo.match", rule.keyword, True))
        d = self._build(rule, keyword=rule.keyword, trace=trace)
        if m.get("reason"):
            d.reason = m["reason"]
        if m.get("operator"):
            d.operator = m["operator"]
        return d

    @staticmethod
    def _shop_allowed(rule: HandoffRule, shop: str) -> bool:
        if not rule.applicable_shops:
            return True
        allowed = [s.strip() for s in rule.applicable_shops.replace("，", ",").split(",") if s.strip()]
        return shop in allowed

    def _build(self, rule: HandoffRule, keyword: Optional[str], trace: List[TraceEntry]) -> HandoffDecision:
        target = select_target(rule.transfer_to, self._rng)
        message = rule.transfer_message or ""
        return HandoffDecision(
            transfer=True,
            target=target,
            keyword=keyword,
            transfer_message=message or None,
            trace=trace,
        )


def evaluate_handoff(context: Dict[str, Any], engine: Optional[HandoffPolicyEngine] = None) -> Dict[str, Any]:
    eng = engine or HandoffPolicyEngine()
    return eng.decide(context) or {"transfer": False}
