"""
SHEEP-305 子任务 4: ConversationEngine 场景路由集成测试

测试 ConversationEngine 根据场景自动路由到正确的知识类型。
"""
import pytest
from unittest.mock import Mock, MagicMock
from fastwork_ai_worker.conversation.conversation_engine import ConversationEngine


class TestConversationEngineSceneRouting:
    """测试 ConversationEngine 场景路由功能"""
    
    @pytest.fixture
    def mock_rag_engine(self):
        """创建模拟的 RAGEngine"""
        engine = Mock()
        engine.retrieve.return_value = {
            "hits": [
                {
                    "raw_similarity": 0.85,
                    "answer": "测试答案",
                    "question": "测试问题",
                    "knowledge_type": "STORE_RULE",
                    "store_knowledge_type": "SHIPPING_TIME"
                }
            ]
        }
        return engine
    
    @pytest.fixture
    def mock_order_context(self):
        """创建模拟的 OrderContextProvider"""
        provider = Mock()
        provider.get_context.return_value = {
            "order_state": "已下单",
            "order_id": "12345"
        }
        return provider
    
    @pytest.fixture
    def conversation_engine(self, mock_rag_engine, mock_order_context):
        """创建 ConversationEngine 实例"""
        return ConversationEngine(
            rag_engine=mock_rag_engine,
            order_context=mock_order_context
        )
    
    def test_scene_routing_shipping_time(self, conversation_engine, mock_rag_engine):
        """测试 SHIPPING_TIME 场景路由"""
        request = {
            "question": "什么时候发货？",
            "scene": "SHIPPING_TIME",
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证 RAGEngine 被调用时传递了正确的过滤参数
        mock_rag_engine.retrieve.assert_called_once()
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        
        assert call_args["query"] == "什么时候发货？"
        assert call_args["knowledge_type"] == "STORE_RULE"
        assert call_args["store_knowledge_type"] == "SHIPPING_TIME"
        assert call_args["product_id"] == "P001"
    
    def test_scene_routing_return_policy(self, conversation_engine, mock_rag_engine):
        """测试 RETURN_POLICY 场景路由"""
        request = {
            "question": "怎么退货？",
            "scene": "RETURN_POLICY",
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证过滤参数
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        assert call_args["knowledge_type"] == "STORE_RULE"
        assert call_args["store_knowledge_type"] == "RETURN_POLICY"
    
    def test_scene_routing_product_inquiry(self, conversation_engine, mock_rag_engine):
        """测试 PRODUCT_INQUIRY 场景路由"""
        request = {
            "question": "这个产品有什么特点？",
            "scene": "PRODUCT_INQUIRY",
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证过滤参数
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        assert call_args["knowledge_type"] == "PRODUCT_KNOWLEDGE"
        assert "store_knowledge_type" not in call_args  # PRODUCT_INQUIRY 没有 store_knowledge_type
    
    def test_scene_routing_no_scene_backward_compatible(self, conversation_engine, mock_rag_engine):
        """测试没有 scene 参数的向后兼容性"""
        request = {
            "question": "一般问题",
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证没有传递过滤参数（向后兼容）
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        assert "knowledge_type" not in call_args
        assert "store_knowledge_type" not in call_args
    
    def test_scene_routing_unknown_scene(self, conversation_engine, mock_rag_engine):
        """测试未知场景的默认处理"""
        request = {
            "question": "未知问题",
            "scene": "UNKNOWN_SCENE",
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证使用默认映射（不传递过滤参数）
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        assert "knowledge_type" not in call_args
        assert "store_knowledge_type" not in call_args
    
    def test_scene_routing_from_scene_classification(self, conversation_engine, mock_rag_engine):
        """测试从 scene_classification 提取场景"""
        request = {
            "question": "什么时候发货？",
            "scene_classification": {
                "scene": "SHIPPING_TIME",
                "confidence": 0.95
            },
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证从 scene_classification 正确提取场景
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        assert call_args["knowledge_type"] == "STORE_RULE"
        assert call_args["store_knowledge_type"] == "SHIPPING_TIME"
    
    def test_scene_routing_trace_logging(self, conversation_engine, mock_rag_engine):
        """测试场景路由的 trace 日志记录"""
        request = {
            "question": "什么时候发货？",
            "scene": "SHIPPING_TIME",
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证 trace 中包含场景路由信息
        assert "trace" in result
        trace = result["trace"]
        
        # 查找 SceneRouting 相关的 trace 记录
        scene_routing_traces = [
            t for t in trace 
            if t.get("stage") == "SceneRouting"
        ]
        
        assert len(scene_routing_traces) > 0
        
        # 验证 trace 内容
        routing_trace = scene_routing_traces[0]
        assert "scene=SHIPPING_TIME" in routing_trace.get("detail", "")
        assert "knowledge_type=STORE_RULE" in routing_trace.get("detail", "")
        assert "store_knowledge_type=SHIPPING_TIME" in routing_trace.get("detail", "")
    
    def test_scene_routing_empty_scene(self, conversation_engine, mock_rag_engine):
        """测试空字符串 scene 的处理"""
        request = {
            "question": "一般问题",
            "scene": "",
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证空字符串被视为无场景（向后兼容）
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        assert "knowledge_type" not in call_args
        assert "store_knowledge_type" not in call_args
    
    def test_scene_routing_none_scene(self, conversation_engine, mock_rag_engine):
        """测试 None scene 的处理"""
        request = {
            "question": "一般问题",
            "scene": None,
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证 None 被视为无场景（向后兼容）
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        assert "knowledge_type" not in call_args
        assert "store_knowledge_type" not in call_args


class TestConversationEngineSceneRoutingEdgeCases:
    """测试场景路由的边界情况"""
    
    @pytest.fixture
    def mock_rag_engine(self):
        """创建模拟的 RAGEngine"""
        engine = Mock()
        engine.retrieve.return_value = {
            "hits": [
                {
                    "raw_similarity": 0.85,
                    "answer": "测试答案",
                    "question": "测试问题"
                }
            ]
        }
        return engine
    
    @pytest.fixture
    def mock_order_context(self):
        """创建模拟的 OrderContextProvider"""
        provider = Mock()
        provider.get_context.return_value = {
            "order_state": "已下单",
            "order_id": "12345"
        }
        return provider
    
    @pytest.fixture
    def conversation_engine(self, mock_rag_engine, mock_order_context):
        """创建 ConversationEngine 实例"""
        return ConversationEngine(
            rag_engine=mock_rag_engine,
            order_context=mock_order_context
        )
    
    def test_scene_priority_over_scene_classification(self, conversation_engine, mock_rag_engine):
        """测试 scene 优先于 scene_classification"""
        request = {
            "question": "什么时候发货？",
            "scene": "SHIPPING_TIME",
            "scene_classification": {
                "scene": "RETURN_POLICY",
                "confidence": 0.95
            },
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证使用 scene 而不是 scene_classification
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        assert call_args["store_knowledge_type"] == "SHIPPING_TIME"
    
    def test_scene_routing_preserves_other_parameters(self, conversation_engine, mock_rag_engine):
        """测试场景路由保留其他请求参数"""
        request = {
            "question": "什么时候发货？",
            "scene": "SHIPPING_TIME",
            "product_id": "P001",
            "order_state": "已下单",
            "top_k": 10
        }
        
        result = conversation_engine.generate(request)
        
        # 验证其他参数被保留
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        assert call_args["query"] == "什么时候发货？"
        assert call_args["product_id"] == "P001"
        assert call_args["order_state"] == "已下单"
        assert call_args["top_k"] == 15  # 注意：代码中硬编码为 15
    
    def test_scene_routing_with_empty_scene_classification(self, conversation_engine, mock_rag_engine):
        """测试空的 scene_classification 对象"""
        request = {
            "question": "一般问题",
            "scene_classification": {},
            "product_id": "P001"
        }
        
        result = conversation_engine.generate(request)
        
        # 验证空的 scene_classification 被视为无场景
        call_args = mock_rag_engine.retrieve.call_args[0][0]
        assert "knowledge_type" not in call_args
        assert "store_knowledge_type" not in call_args
