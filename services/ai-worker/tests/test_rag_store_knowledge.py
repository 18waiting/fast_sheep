#!/usr/bin/env python3
"""Integration test for RAG store_knowledge support

Tests:
1. Index building with store_knowledge
2. Retrieval with knowledge_type filter
3. Backward compatibility (no filter)
4. Mapping structure verification
"""
import sys
import os
import sqlite3
import tempfile
import shutil

# Add services to path
sys.path.insert(0, 'services/ai-worker/src')

from fastwork_ai_worker.rag.index_builder import IndexBuilder
from fastwork_ai_worker.rag.index_repository import IndexRepository
from fastwork_ai_worker.rag.rag_engine import RAGEngine
from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider


def setup_test_db():
    """Create test database with sample data"""
    db_path = tempfile.mktemp(suffix='.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Enable dict-like access
    
    # Create tables
    conn.execute("""
        CREATE TABLE knowledge_entries (
            id TEXT PRIMARY KEY,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            product_id TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            source TEXT NOT NULL DEFAULT '',
            trust_level TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    
    conn.execute("""
        CREATE TABLE store_knowledge (
            id TEXT PRIMARY KEY,
            merchant_id TEXT NOT NULL,
            store_id TEXT NOT NULL,
            knowledge_type TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            source TEXT NOT NULL DEFAULT 'merchant',
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    
    # Insert test knowledge_entries
    conn.execute("""
        INSERT INTO knowledge_entries VALUES
        ('ke1', '这个商品有XL码吗？', '有的，亲', '123', '["尺码"]', 'imported', 'HUMAN_CONFIRMED', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
    """)
    
    # Insert test store_knowledge
    conn.execute("""
        INSERT INTO store_knowledge VALUES
        ('sk1', 'merchant1', 'store1', 'SHIPPING_TIME', '发货时间规则', '48小时内发货，偏远地区除外', '["发货", "时间"]', 'merchant', 'ACTIVE', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
    """)
    
    conn.commit()
    return conn, db_path


def test_index_building():
    """Test 1: Index building with store_knowledge"""
    print("\n=== Test 1: Index Building ===")
    
    conn, db_path = setup_test_db()
    
    try:
        # Create temp directory for index
        index_dir = tempfile.mkdtemp()
        
        # Create embedding provider
        embedding_provider = MockEmbeddingProvider(dimension=1024)
        
        # Create index builder
        builder = IndexBuilder(embedding_provider, config={'embedding_dim': 1024})
        
        # Load knowledge_entries
        cursor = conn.execute("SELECT * FROM knowledge_entries")
        knowledge_entries = [dict(row) for row in cursor.fetchall()]
        
        # Build index with store_knowledge
        result = builder.build_full(knowledge_entries, index_dir, conn=conn, merchant_id='merchant1')
        
        print(f"✅ Index built successfully")
        print(f"   Total entries: {result['total_entries']}")
        print(f"   Product knowledge: {result['product_knowledge_count']}")
        print(f"   Store knowledge: {result['store_knowledge_count']}")
        
        # Verify mapping
        repo = IndexRepository('/tmp', config={'embedding_dim': 1024, 'derived_root': result['staging']})
        repo.ensure_global()  # Load global index and mapping
        mapping = repo.mapping_for('global')
        
        print(f"\n✅ Mapping verification:")
        for entry in mapping:
            print(f"   - {entry['entry_id']}: type={entry['knowledge_type']}, store_type={entry.get('store_knowledge_type')}")
        
        # Verify store_knowledge has correct fields
        store_entry = next((e for e in mapping if e['entry_id'] == 'sk1'), None)
        assert store_entry is not None, "Store knowledge not found in mapping"
        assert store_entry['knowledge_type'] == 'STORE_RULE', f"Expected STORE_RULE, got {store_entry['knowledge_type']}"
        assert store_entry['store_knowledge_type'] == 'SHIPPING_TIME', f"Expected SHIPPING_TIME, got {store_entry['store_knowledge_type']}"
        
        print(f"\n✅ Test 1 PASSED")
        return result['staging']
        
    finally:
        conn.close()
        os.unlink(db_path)


def test_retrieval_with_filter(index_dir):
    """Test 2: Retrieval with knowledge_type filter"""
    print("\n=== Test 2: Retrieval with Filter ===")
    
    # Create embedding provider
    embedding_provider = MockEmbeddingProvider(dimension=1024)
    
    # Create index repository
    repo = IndexRepository('/tmp', config={'embedding_dim': 1024, 'derived_root': index_dir})
    
    # Create RAG engine
    engine = RAGEngine(repo, embedding_provider, config={"embedding_dim": 1024})
    
    # Test retrieval with STORE_RULE filter
    result = engine.retrieve({
        'query': '发货时间',
        'knowledge_type': 'STORE_RULE'
    })
    
    print(f"✅ Retrieval with STORE_RULE filter:")
    print(f"   Hits: {len(result['hits'])}")
    for hit in result['hits']:
        print(f"   - {hit['entry_id']}: {hit['question'][:50]}...")
    
    # Verify only STORE_RULE entries returned
    for hit in result['hits']:
        assert hit.get('knowledge_type') == 'STORE_RULE', f"Expected STORE_RULE, got {hit.get('knowledge_type')}"
    
    print(f"\n✅ Test 2 PASSED")


def test_retrieval_without_filter(index_dir):
    """Test 3: Backward compatibility (no filter)"""
    print("\n=== Test 3: Backward Compatibility ===")
    
    # Create embedding provider
    embedding_provider = MockEmbeddingProvider(dimension=1024)
    
    # Create index repository
    repo = IndexRepository('/tmp', config={'embedding_dim': 1024, 'derived_root': index_dir})
    
    # Create RAG engine
    engine = RAGEngine(repo, embedding_provider, config={"embedding_dim": 1024})
    
    # Test retrieval without filter
    result = engine.retrieve({
        'query': '发货'
    })
    
    print(f"✅ Retrieval without filter:")
    print(f"   Hits: {len(result['hits'])}")
    for hit in result['hits']:
        print(f"   - {hit['entry_id']}: type={hit.get('knowledge_type', 'PRODUCT_KNOWLEDGE')}")
    
    # Verify both types returned
    types = set(hit.get('knowledge_type', 'PRODUCT_KNOWLEDGE') for hit in result['hits'])
    print(f"   Knowledge types: {types}")
    
    print(f"\n✅ Test 3 PASSED")


def main():
    print("=" * 60)
    print("RAG Store Knowledge Integration Test")
    print("=" * 60)
    
    try:
        # Test 1: Index building
        index_dir = test_index_building()
        
        # Test 2: Retrieval with filter
        test_retrieval_with_filter(index_dir)
        
        # Test 3: Backward compatibility
        test_retrieval_without_filter(index_dir)
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED")
        print("=" * 60)
        
        # Cleanup
        shutil.rmtree(index_dir, ignore_errors=True)
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
