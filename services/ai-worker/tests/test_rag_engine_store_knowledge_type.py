"""Tests for RAGEngine store_knowledge_type parameter passing (SHEEP-305 子任务 2)

验证 RAGEngine.retrieve() 能够从 request 提取 store_knowledge_type 并传递给 retriever。

DEFERRED: 需要在个人电脑（Windows, Node v22+）上运行测试
"""
import pytest
from unittest.mock import Mock, MagicMock, patch
import numpy as np

from fastwork_ai_worker.rag.rag_engine import RAGEngine


class TestRAGEngineStoreKnowledgeType:
    """Test RAGEngine store_knowledge_type parameter passing"""

    @pytest.fixture
    def mock_config(self):
        """Create mock config"""
        return {
            "product_search_top_k": 15,
            "product_quality_threshold": 0.6,
            "min_search_score": 0.02,
            "product_isolation": False,
            "global_search_multiplier": 2,
            "reference_top_n": 10,
        }

    @pytest.fixture
    def mock_repo(self):
        """Create mock IndexRepository"""
        repo = Mock()
        repo.ready.return_value = True
        return repo

    @pytest.fixture
    def mock_retriever(self):
        """Create mock Retriever"""
        retriever = Mock()
        retriever.retrieve.return_value = Mock(
            common_hits=[],
            product_hits=[],
            global_hits=[],
            tier_used="none"
        )
        return retriever

    @pytest.fixture
    def mock_reranker(self):
        """Create mock Reranker"""
        reranker = Mock()
        reranker.call_log = []
        reranker.rerank.return_value = []
        return reranker

    @pytest.fixture
    def rag_engine(self, mock_config, mock_repo, mock_retriever, mock_reranker):
        """Create RAGEngine with mocks"""
        with patch('fastwork_ai_worker.rag.rag_engine.IndexRepository', return_value=mock_repo):
            with patch('fastwork_ai_worker.rag.rag_engine.Retriever', return_value=mock_retriever):
                with patch('fastwork_ai_worker.rag.rag_engine.Reranker', return_value=mock_reranker):
                    engine = RAGEngine(mock_config)
                    engine.repo = mock_repo
                    engine.retriever = mock_retriever
                    engine.reranker = mock_reranker
                    # Mock embed_query to return a simple vector
                    engine.embed_query = Mock(return_value=np.array([0.1, 0.2, 0.3]))
                    return engine

    def test_rag_engine_extracts_store_knowledge_type_from_request(self, rag_engine, mock_retriever):
        """Test RAGEngine extracts store_knowledge_type from request"""
        # Setup
        request = {
            "query": "发货时间",
            "store_knowledge_type": "SHIPPING_TIME",
        }

        # Execute
        rag_engine.retrieve(request)

        # Verify: retriever.retrieve() called with store_knowledge_type
        mock_retriever.retrieve.assert_called_once()
        call_kwargs = mock_retriever.retrieve.call_args[1]
        assert call_kwargs.get("store_knowledge_type") == "SHIPPING_TIME"

    def test_rag_engine_passes_store_knowledge_type_to_retriever(self, rag_engine, mock_retriever):
        """Test RAGEngine passes store_knowledge_type to retriever"""
        # Setup
        request = {
            "query": "退货政策",
            "knowledge_type": "STORE_RULE",
            "store_knowledge_type": "RETURN_POLICY",
        }

        # Execute
        rag_engine.retrieve(request)

        # Verify: Both knowledge_type and store_knowledge_type passed
        mock_retriever.retrieve.assert_called_once()
        call_kwargs = mock_retriever.retrieve.call_args[1]
        assert call_kwargs.get("knowledge_type") == "STORE_RULE"
        assert call_kwargs.get("store_knowledge_type") == "RETURN_POLICY"

    def test_rag_engine_defaults_to_none_when_not_provided(self, rag_engine, mock_retriever):
        """Test RAGEngine defaults to None when store_knowledge_type not in request"""
        # Setup
        request = {
            "query": "产品问题",
        }

        # Execute
        rag_engine.retrieve(request)

        # Verify: store_knowledge_type defaults to None (backward compatible)
        mock_retriever.retrieve.assert_called_once()
        call_kwargs = mock_retriever.retrieve.call_args[1]
        assert call_kwargs.get("store_knowledge_type") is None

    def test_rag_engine_backward_compatibility(self, rag_engine, mock_retriever):
        """Test backward compatibility: old API without store_knowledge_type still works"""
        # Setup: Old-style request without store_knowledge_type
        request = {
            "query": "问题",
            "product_id": "123",
            "top_k": 10,
        }

        # Execute
        result = rag_engine.retrieve(request)

        # Verify: Works without error
        assert result is not None
        mock_retriever.retrieve.assert_called_once()
        # Verify store_knowledge_type is None (not passed)
        call_kwargs = mock_retriever.retrieve.call_args[1]
        assert call_kwargs.get("store_knowledge_type") is None

    def test_rag_engine_passes_all_parameters_together(self, rag_engine, mock_retriever):
        """Test RAGEngine passes all parameters together correctly"""
        # Setup
        request = {
            "query": "发货时间",
            "product_id": "456",
            "top_k": 20,
            "knowledge_isolation": True,
            "knowledge_type": "STORE_RULE",
            "store_knowledge_type": "SHIPPING_TIME",
        }

        # Execute
        rag_engine.retrieve(request)

        # Verify: All parameters passed correctly
        mock_retriever.retrieve.assert_called_once()
        call_args = mock_retriever.retrieve.call_args
        
        # Positional args: query_vector, product_id, top_k
        assert call_args[0][1] == "456"  # product_id
        assert call_args[0][2] == 20     # top_k
        
        # Keyword args
        call_kwargs = call_args[1]
        assert call_kwargs.get("knowledge_isolation") is True
        assert call_kwargs.get("knowledge_type") == "STORE_RULE"
        assert call_kwargs.get("store_knowledge_type") == "SHIPPING_TIME"


class TestRAGEngineIntegration:
    """Integration tests for RAGEngine with store_knowledge_type"""

    @pytest.mark.integration
    def test_rag_engine_integration_with_store_knowledge(self):
        """Integration test: RAGEngine with real store_knowledge index
        
        DEFERRED: 需要在个人电脑上运行，需要真实的索引数据
        """
        # This would require:
        # 1. Real IndexRepository with store_knowledge entries
        # 2. Real FAISS index
        # 3. Real embedding model
        pass


# Edge case tests
class TestRAGEngineEdgeCases:
    """Test edge cases for RAGEngine store_knowledge_type handling"""

    @pytest.fixture
    def rag_engine(self):
        """Create RAGEngine with minimal mocks"""
        config = {"product_search_top_k": 15}
        mock_repo = Mock()
        mock_repo.ready.return_value = True
        mock_retriever = Mock()
        mock_retriever.retrieve.return_value = Mock(
            common_hits=[],
            product_hits=[],
            global_hits=[],
            tier_used="none"
        )
        mock_reranker = Mock()
        mock_reranker.call_log = []
        mock_reranker.rerank.return_value = []
        
        with patch('fastwork_ai_worker.rag.rag_engine.IndexRepository', return_value=mock_repo):
            with patch('fastwork_ai_worker.rag.rag_engine.Retriever', return_value=mock_retriever):
                with patch('fastwork_ai_worker.rag.rag_engine.Reranker', return_value=mock_reranker):
                    engine = RAGEngine(config)
                    engine.repo = mock_repo
                    engine.retriever = mock_retriever
                    engine.reranker = mock_reranker
                    engine.embed_query = Mock(return_value=np.array([0.1, 0.2, 0.3]))
                    return engine

    def test_empty_string_store_knowledge_type_treated_as_none(self, rag_engine, mock_retriever):
        """Test empty string store_knowledge_type is treated as None"""
        # Setup
        request = {
            "query": "问题",
            "store_knowledge_type": "",  # Empty string
        }

        # Execute
        rag_engine.retrieve(request)

        # Verify: Empty string passed as-is (Retriever will handle it)
        mock_retriever.retrieve.assert_called_once()
        call_kwargs = mock_retriever.retrieve.call_args[1]
        # Empty string is falsy, so Retriever won't filter
        assert call_kwargs.get("store_knowledge_type") == ""

    def test_none_store_knowledge_type_explicitly(self, rag_engine, mock_retriever):
        """Test None store_knowledge_type explicitly passed"""
        # Setup
        request = {
            "query": "问题",
            "store_knowledge_type": None,  # Explicitly None
        }

        # Execute
        rag_engine.retrieve(request)

        # Verify: None passed to retriever
        mock_retriever.retrieve.assert_called_once()
        call_kwargs = mock_retriever.retrieve.call_args[1]
        assert call_kwargs.get("store_knowledge_type") is None
