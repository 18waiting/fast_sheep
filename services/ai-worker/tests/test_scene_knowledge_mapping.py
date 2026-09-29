"""Tests for Scene to Knowledge Type Mapping (SHEEP-305 子任务 3)

验证场景→知识类型映射功能正确工作。

DEFERRED: 需要在个人电脑（Windows, Node v22+）上运行测试
"""
import pytest

from fastwork_ai_worker.conversation.scene_knowledge_mapping import (
    get_knowledge_filter,
    get_all_scenes,
    is_scene_recognized,
    SCENE_KNOWLEDGE_MAPPING,
    DEFAULT_MAPPING,
)


class TestGetKnowledgeFilter:
    """测试 get_knowledge_filter() 函数"""

    def test_shipping_time_mapping(self):
        """测试 SHIPPING_TIME 场景映射"""
        knowledge_type, store_knowledge_type = get_knowledge_filter("SHIPPING_TIME")
        assert knowledge_type == "STORE_RULE"
        assert store_knowledge_type == "SHIPPING_TIME"

    def test_return_policy_mapping(self):
        """测试 RETURN_POLICY 场景映射"""
        knowledge_type, store_knowledge_type = get_knowledge_filter("RETURN_POLICY")
        assert knowledge_type == "STORE_RULE"
        assert store_knowledge_type == "RETURN_POLICY"

    def test_product_inquiry_mapping(self):
        """测试 PRODUCT_INQUIRY 场景映射"""
        knowledge_type, store_knowledge_type = get_knowledge_filter("PRODUCT_INQUIRY")
        assert knowledge_type == "PRODUCT_KNOWLEDGE"
        assert store_knowledge_type is None

    def test_faq_mapping(self):
        """测试 FAQ 场景映射"""
        knowledge_type, store_knowledge_type = get_knowledge_filter("FAQ")
        assert knowledge_type == "STORE_RULE"
        assert store_knowledge_type == "FAQ"

    def test_unknown_scene_returns_default(self):
        """测试未知场景返回默认映射"""
        knowledge_type, store_knowledge_type = get_knowledge_filter("UNKNOWN_SCENE")
        assert knowledge_type == "ALL"
        assert store_knowledge_type is None

    def test_none_scene_returns_default(self):
        """测试 None 场景返回默认映射"""
        knowledge_type, store_knowledge_type = get_knowledge_filter(None)
        assert knowledge_type == "ALL"
        assert store_knowledge_type is None

    def test_empty_string_scene_returns_default(self):
        """测试空字符串场景返回默认映射"""
        knowledge_type, store_knowledge_type = get_knowledge_filter("")
        assert knowledge_type == "ALL"
        assert store_knowledge_type is None

    def test_all_mapped_scenes(self):
        """测试所有已映射场景"""
        for scene, expected in SCENE_KNOWLEDGE_MAPPING.items():
            result = get_knowledge_filter(scene)
            assert result == expected, f"Scene {scene} mapping mismatch"


class TestGetAllScenes:
    """测试 get_all_scenes() 函数"""

    def test_returns_list(self):
        """测试返回类型为列表"""
        scenes = get_all_scenes()
        assert isinstance(scenes, list)

    def test_contains_all_mapped_scenes(self):
        """测试包含所有已映射场景"""
        scenes = get_all_scenes()
        for scene in SCENE_KNOWLEDGE_MAPPING.keys():
            assert scene in scenes

    def test_contains_shipping_time(self):
        """测试包含 SHIPPING_TIME"""
        scenes = get_all_scenes()
        assert "SHIPPING_TIME" in scenes

    def test_contains_return_policy(self):
        """测试包含 RETURN_POLICY"""
        scenes = get_all_scenes()
        assert "RETURN_POLICY" in scenes

    def test_contains_product_inquiry(self):
        """测试包含 PRODUCT_INQUIRY"""
        scenes = get_all_scenes()
        assert "PRODUCT_INQUIRY" in scenes

    def test_contains_faq(self):
        """测试包含 FAQ"""
        scenes = get_all_scenes()
        assert "FAQ" in scenes

    def test_scene_count_matches_mapping(self):
        """测试场景数量与映射表一致"""
        scenes = get_all_scenes()
        assert len(scenes) == len(SCENE_KNOWLEDGE_MAPPING)


class TestIsSceneRecognized:
    """测试 is_scene_recognized() 函数"""

    def test_shipping_time_recognized(self):
        """测试 SHIPPING_TIME 被识别"""
        assert is_scene_recognized("SHIPPING_TIME") is True

    def test_return_policy_recognized(self):
        """测试 RETURN_POLICY 被识别"""
        assert is_scene_recognized("RETURN_POLICY") is True

    def test_product_inquiry_recognized(self):
        """测试 PRODUCT_INQUIRY 被识别"""
        assert is_scene_recognized("PRODUCT_INQUIRY") is True

    def test_faq_recognized(self):
        """测试 FAQ 被识别"""
        assert is_scene_recognized("FAQ") is True

    def test_unknown_scene_not_recognized(self):
        """测试未知场景不被识别"""
        assert is_scene_recognized("UNKNOWN_SCENE") is False

    def test_none_not_recognized(self):
        """测试 None 不被识别"""
        assert is_scene_recognized(None) is False

    def test_empty_string_not_recognized(self):
        """测试空字符串不被识别"""
        assert is_scene_recognized("") is False


class TestDefaultMapping:
    """测试 DEFAULT_MAPPING 常量"""

    def test_default_mapping_structure(self):
        """测试默认映射结构"""
        assert isinstance(DEFAULT_MAPPING, tuple)
        assert len(DEFAULT_MAPPING) == 2

    def test_default_mapping_values(self):
        """测试默认映射值"""
        knowledge_type, store_knowledge_type = DEFAULT_MAPPING
        assert knowledge_type == "ALL"
        assert store_knowledge_type is None


class TestSceneKnowledgeMapping:
    """测试 SCENE_KNOWLEDGE_MAPPING 常量"""

    def test_mapping_is_dict(self):
        """测试映射表为字典类型"""
        assert isinstance(SCENE_KNOWLEDGE_MAPPING, dict)

    def test_mapping_not_empty(self):
        """测试映射表非空"""
        assert len(SCENE_KNOWLEDGE_MAPPING) > 0

    def test_all_values_are_tuples(self):
        """测试所有值为元组"""
        for scene, mapping in SCENE_KNOWLEDGE_MAPPING.items():
            assert isinstance(mapping, tuple), f"Scene {scene} value is not a tuple"
            assert len(mapping) == 2, f"Scene {scene} tuple length is not 2"

    def test_all_knowledge_types_valid(self):
        """测试所有 knowledge_type 值有效"""
        valid_types = {"STORE_RULE", "PRODUCT_KNOWLEDGE", "ALL"}
        for scene, (knowledge_type, _) in SCENE_KNOWLEDGE_MAPPING.items():
            assert knowledge_type in valid_types, f"Scene {scene} has invalid knowledge_type: {knowledge_type}"

    def test_all_store_knowledge_types_valid(self):
        """测试所有 store_knowledge_type 值有效"""
        valid_types = {"SHIPPING_TIME", "RETURN_POLICY", "FAQ", "OTHER", None}
        for scene, (_, store_knowledge_type) in SCENE_KNOWLEDGE_MAPPING.items():
            assert store_knowledge_type in valid_types, f"Scene {scene} has invalid store_knowledge_type: {store_knowledge_type}"


class TestEdgeCases:
    """测试边界情况"""

    def test_case_sensitive(self):
        """测试大小写敏感"""
        # 大写应该被识别
        assert is_scene_recognized("SHIPPING_TIME") is True
        # 小写不应该被识别（大小写敏感）
        assert is_scene_recognized("shipping_time") is False

    def test_whitespace_not_recognized(self):
        """测试空白字符串不被识别"""
        assert is_scene_recognized("   ") is False
        assert is_scene_recognized("\t") is False
        assert is_scene_recognized("\n") is False

    def test_special_characters_not_recognized(self):
        """测试特殊字符不被识别"""
        assert is_scene_recognized("SHIPPING_TIME!") is False
        assert is_scene_recognized("SHIPPING-TIME") is False
        assert is_scene_recognized("SHIPPING_TIME ") is False


class TestIntegration:
    """集成测试"""

    @pytest.mark.integration
    def test_integration_with_rag_engine(self):
        """测试与 RAG 引擎的集成
        
        DEFERRED: 需要在个人电脑上运行，需要完整的 RAG 环境
        """
        # This would require:
        # 1. Real RAGEngine instance
        # 2. Real index with store_knowledge entries
        # 3. Verify that get_knowledge_filter() returns correct filters
        # 4. Verify that RAGEngine uses these filters correctly
        pass

    def test_mapping_consistency(self):
        """测试映射一致性"""
        # 验证 get_knowledge_filter() 返回的结果与 SCENE_KNOWLEDGE_MAPPING 一致
        for scene in get_all_scenes():
            result = get_knowledge_filter(scene)
            expected = SCENE_KNOWLEDGE_MAPPING[scene]
            assert result == expected, f"Inconsistency for scene {scene}"
