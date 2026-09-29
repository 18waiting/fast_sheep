"""Scene to Knowledge Type Mapping (SHEEP-305 子任务 3)

Maps conversation scenes to knowledge types for RAG retrieval filtering.

This module provides a mapping from conversation scenes (e.g., SHIPPING_TIME, 
RETURN_POLICY) to the corresponding knowledge_type and store_knowledge_type 
filters used by the RAG retrieval system.

Usage:
    from fastwork_ai_worker.conversation.scene_knowledge_mapping import get_knowledge_filter
    
    knowledge_type, store_knowledge_type = get_knowledge_filter("SHIPPING_TIME")
    # Returns: ("STORE_RULE", "SHIPPING_TIME")
"""
from typing import Dict, Optional, Tuple


# Scene → (knowledge_type, store_knowledge_type) mapping
# 
# This mapping defines which knowledge types should be retrieved for each scene.
# - knowledge_type: High-level classification (STORE_RULE, PRODUCT_KNOWLEDGE, ALL)
# - store_knowledge_type: Specific store knowledge type (SHIPPING_TIME, RETURN_POLICY, FAQ, etc.)
#
# When scene is not recognized, returns DEFAULT_MAPPING which retrieves all knowledge types.
SCENE_KNOWLEDGE_MAPPING: Dict[str, Tuple[str, Optional[str]]] = {
    # Shipping time inquiries → Store rules about shipping
    "SHIPPING_TIME": ("STORE_RULE", "SHIPPING_TIME"),
    
    # Return policy inquiries → Store rules about returns
    "RETURN_POLICY": ("STORE_RULE", "RETURN_POLICY"),
    
    # Product-specific inquiries → Product knowledge base
    "PRODUCT_INQUIRY": ("PRODUCT_KNOWLEDGE", None),
    
    # Frequently asked questions → Store FAQ
    "FAQ": ("STORE_RULE", "FAQ"),
}


# Default mapping when scene is not recognized or not provided
# Returns ("ALL", None) which means no filtering - retrieve all knowledge types
DEFAULT_MAPPING: Tuple[str, Optional[str]] = ("ALL", None)


def get_knowledge_filter(scene: Optional[str]) -> Tuple[str, Optional[str]]:
    """Get knowledge_type and store_knowledge_type for a given scene.
    
    This function maps a conversation scene to the appropriate knowledge type
    filters for RAG retrieval. The filters are used to narrow down the search
    to relevant knowledge entries.
    
    Args:
        scene: Scene identifier (e.g., "SHIPPING_TIME", "RETURN_POLICY")
               Can be None or an unrecognized value.
    
    Returns:
        Tuple of (knowledge_type, store_knowledge_type):
        - knowledge_type: "STORE_RULE" | "PRODUCT_KNOWLEDGE" | "ALL"
        - store_knowledge_type: "SHIPPING_TIME" | "RETURN_POLICY" | "FAQ" | None
    
    Examples:
        >>> get_knowledge_filter("SHIPPING_TIME")
        ("STORE_RULE", "SHIPPING_TIME")
        
        >>> get_knowledge_filter("RETURN_POLICY")
        ("STORE_RULE", "RETURN_POLICY")
        
        >>> get_knowledge_filter("PRODUCT_INQUIRY")
        ("PRODUCT_KNOWLEDGE", None)
        
        >>> get_knowledge_filter("FAQ")
        ("STORE_RULE", "FAQ")
        
        >>> get_knowledge_filter("UNKNOWN_SCENE")
        ("ALL", None)
        
        >>> get_knowledge_filter(None)
        ("ALL", None)
    
    Notes:
        - When scene is None or not recognized, returns DEFAULT_MAPPING
        - DEFAULT_MAPPING retrieves all knowledge types (no filtering)
        - This ensures backward compatibility with existing code
    """
    if not scene:
        return DEFAULT_MAPPING
    return SCENE_KNOWLEDGE_MAPPING.get(scene, DEFAULT_MAPPING)


def get_all_scenes() -> list:
    """Get list of all recognized scenes.
    
    Returns:
        List of scene identifiers (e.g., ["SHIPPING_TIME", "RETURN_POLICY", ...])
    
    Example:
        >>> scenes = get_all_scenes()
        >>> "SHIPPING_TIME" in scenes
        True
    """
    return list(SCENE_KNOWLEDGE_MAPPING.keys())


def is_scene_recognized(scene: Optional[str]) -> bool:
    """Check if a scene is recognized (has a mapping).
    
    Args:
        scene: Scene identifier to check
    
    Returns:
        True if scene has a mapping, False otherwise
    
    Example:
        >>> is_scene_recognized("SHIPPING_TIME")
        True
        >>> is_scene_recognized("UNKNOWN_SCENE")
        False
        >>> is_scene_recognized(None)
        False
    """
    if not scene:
        return False
    return scene in SCENE_KNOWLEDGE_MAPPING
