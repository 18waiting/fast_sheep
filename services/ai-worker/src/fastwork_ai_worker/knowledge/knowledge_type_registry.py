"""Knowledge Type Registry (SHEEP-305, RAG Knowledge Base Infrastructure).

Registry for knowledge types. Supports registering new types without code changes.
Aligned with DEC-008 (Layered Knowledge Architecture).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Sequence, Tuple


class KnowledgeLayer(str, Enum):
    """Knowledge layers per DEC-008."""
    SYSTEM = "SYSTEM"           # Layer 1: System/Platform rules (global)
    MERCHANT = "MERCHANT"       # Layer 2: Merchant-wide rules
    STORE = "STORE"             # Layer 3: Store-specific rules
    PRODUCT = "PRODUCT"         # Layer 4: Product-specific rules
    CONVERSATION = "CONVERSATION"  # Layer 5: Conversation temporary context


class SceneType(str, Enum):
    """Query scenes that route to specific knowledge types."""
    SHIPPING_TIME = "SHIPPING_TIME"       # 发货时间相关咨询
    PRODUCT_INQUIRY = "PRODUCT_INQUIRY"   # 商品规格/属性咨询
    RETURN_POLICY = "RETURN_POLICY"       # 退换货政策咨询
    ORDER_STATUS = "ORDER_STATUS"         # 订单状态咨询
    LOGISTICS = "LOGISTICS"               # 物流相关咨询
    FAQ = "FAQ"                           # 常见问题
    GENERAL = "GENERAL"                   # 通用咨询（兜底）


@dataclass(frozen=True)
class KnowledgeTypeDefinition:
    """Definition of a registered knowledge type."""
    type: str
    display_name: str
    layer: KnowledgeLayer
    scenes: Tuple[SceneType, ...]
    active: bool = True
    description: Optional[str] = None


# Built-in knowledge type definitions
BUILTIN_KNOWLEDGE_TYPES: Tuple[KnowledgeTypeDefinition, ...] = (
    KnowledgeTypeDefinition(
        type="SHIPPING_TIME",
        display_name="发货时间规则",
        layer=KnowledgeLayer.STORE,
        scenes=(SceneType.SHIPPING_TIME,),
        description="商家配置的发货时间规则，包括发货时限、特殊情况等",
    ),
    KnowledgeTypeDefinition(
        type="RETURN_POLICY",
        display_name="退换货政策",
        layer=KnowledgeLayer.STORE,
        scenes=(SceneType.RETURN_POLICY,),
        description="商家配置的退换货政策",
    ),
    KnowledgeTypeDefinition(
        type="FAQ",
        display_name="常见问题",
        layer=KnowledgeLayer.STORE,
        scenes=(SceneType.FAQ, SceneType.GENERAL),
        description="商家配置的常见问题解答",
    ),
    KnowledgeTypeDefinition(
        type="OTHER",
        display_name="其他知识",
        layer=KnowledgeLayer.STORE,
        scenes=(SceneType.GENERAL,),
        description="其他类型的店铺知识",
    ),
)


class KnowledgeTypeRegistry:
    """Registry for knowledge types.

    Supports registering new types without code changes (open for extension).
    Thread-safe for reads after initialization.
    """

    def __init__(self) -> None:
        self._types: Dict[str, KnowledgeTypeDefinition] = {}
        self._scene_index: Dict[SceneType, List[str]] = {}
        # Register built-in types
        for definition in BUILTIN_KNOWLEDGE_TYPES:
            self.register(definition)

    def register(self, definition: KnowledgeTypeDefinition) -> None:
        """Register a new knowledge type."""
        self._types[definition.type] = definition
        # Update scene index
        for scene in definition.scenes:
            if scene not in self._scene_index:
                self._scene_index[scene] = []
            if definition.type not in self._scene_index[scene]:
                self._scene_index[scene].append(definition.type)

    def get_type(self, type_name: str) -> Optional[KnowledgeTypeDefinition]:
        """Get a knowledge type by its type identifier."""
        return self._types.get(type_name)

    def get_types_for_scene(self, scene: SceneType) -> List[KnowledgeTypeDefinition]:
        """Get all knowledge types that can handle a given scene."""
        type_names = self._scene_index.get(scene, [])
        return [
            self._types[name]
            for name in type_names
            if name in self._types and self._types[name].active
        ]

    def get_all_types(self) -> List[KnowledgeTypeDefinition]:
        """Get all registered knowledge types."""
        return list(self._types.values())

    def has_type(self, type_name: str) -> bool:
        """Check if a knowledge type is registered."""
        return type_name in self._types

    def get_active_types_by_layer(self, layer: KnowledgeLayer) -> List[KnowledgeTypeDefinition]:
        """Get all active knowledge types for a given layer."""
        return [
            t for t in self._types.values()
            if t.layer == layer and t.active
        ]
