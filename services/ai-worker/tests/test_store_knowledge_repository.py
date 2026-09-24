"""SHEEP-305: StoreKnowledgeRepository tests (MVP-A, keyword retrieval)."""
from __future__ import annotations

import json
import sqlite3
import tempfile
from pathlib import Path

import pytest

from fastwork_ai_worker.persistence.store_knowledge_repository import StoreKnowledgeRepository


@pytest.fixture
def db_conn():
    """Create an in-memory database with the store_knowledge table."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE store_knowledge (
            id TEXT PRIMARY KEY,
            merchant_id TEXT NOT NULL,
            store_id TEXT NOT NULL,
            knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('SHIPPING_TIME', 'RETURN_POLICY', 'FAQ', 'OTHER')),
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            source TEXT NOT NULL DEFAULT 'OWNER_INPUT' CHECK (source IN ('OWNER_INPUT', 'IMPORTED')),
            status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'ARCHIVED')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX idx_store_knowledge_scope ON store_knowledge(merchant_id, store_id, knowledge_type, status)")
    yield conn
    conn.close()


@pytest.fixture
def repo(db_conn):
    return StoreKnowledgeRepository(db_conn)


def insert_entry(conn, **kwargs):
    """Helper to insert a test entry."""
    defaults = {
        "id": "test-1",
        "merchant_id": "m1",
        "store_id": "s1",
        "knowledge_type": "SHIPPING_TIME",
        "title": "Test Title",
        "content": "Test Content",
        "tags": "[]",
        "source": "OWNER_INPUT",
        "status": "ACTIVE",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    defaults.update(kwargs)
    conn.execute(
        """INSERT INTO store_knowledge (id, merchant_id, store_id, knowledge_type, title, content, tags, source, status, created_at, updated_at)
           VALUES (:id, :merchant_id, :store_id, :knowledge_type, :title, :content, :tags, :source, :status, :created_at, :updated_at)""",
        defaults,
    )
    conn.commit()


class TestStoreKnowledgeRepository:
    def test_get_existing_entry(self, repo, db_conn):
        insert_entry(db_conn, id="get-1", merchant_id="m1", title="Get Test")
        entry = repo.get("get-1", "m1")
        assert entry is not None
        assert entry["id"] == "get-1"
        assert entry["merchant_id"] == "m1"
        assert entry["title"] == "Get Test"

    def test_get_nonexistent_returns_none(self, repo):
        assert repo.get("nonexistent", "m1") is None

    def test_get_wrong_merchant_returns_none(self, repo, db_conn):
        insert_entry(db_conn, id="scope-1", merchant_id="m1")
        assert repo.get("scope-1", "m2") is None

    def test_list_by_merchant_and_store(self, repo, db_conn):
        insert_entry(db_conn, id="l1", merchant_id="m1", store_id="s1")
        insert_entry(db_conn, id="l2", merchant_id="m1", store_id="s1")
        insert_entry(db_conn, id="l3", merchant_id="m1", store_id="s2")

        entries = repo.list("m1", "s1")
        assert len(entries) == 2
        assert all(e["merchant_id"] == "m1" and e["store_id"] == "s1" for e in entries)

    def test_list_filters_by_knowledge_type(self, repo, db_conn):
        insert_entry(db_conn, id="t1", knowledge_type="SHIPPING_TIME")
        insert_entry(db_conn, id="t2", knowledge_type="FAQ")

        entries = repo.list("m1", "s1", knowledge_type="FAQ")
        assert len(entries) == 1
        assert entries[0]["knowledge_type"] == "FAQ"

    def test_list_filters_by_status(self, repo, db_conn):
        insert_entry(db_conn, id="s1", status="ACTIVE")
        insert_entry(db_conn, id="s2", status="DRAFT")

        entries = repo.list("m1", "s1", status="ACTIVE")
        assert len(entries) == 1
        assert entries[0]["status"] == "ACTIVE"

    def test_query_keyword_in_title(self, repo, db_conn):
        insert_entry(db_conn, id="k1", title="常规发货时间", content="其他内容")
        insert_entry(db_conn, id="k2", title="退货政策", content="其他内容")

        entries = repo.query("m1", "s1", keywords=["发货"])
        assert len(entries) == 1
        assert entries[0]["id"] == "k1"

    def test_query_keyword_in_content(self, repo, db_conn):
        insert_entry(db_conn, id="k1", title="标题", content="48小时内发货")
        insert_entry(db_conn, id="k2", title="标题", content="7天无理由退货")

        entries = repo.query("m1", "s1", keywords=["48小时"])
        assert len(entries) == 1
        assert entries[0]["id"] == "k1"

    def test_query_keyword_in_tags(self, repo, db_conn):
        insert_entry(db_conn, id="k1", tags=json.dumps(["发货", "时间"]))
        insert_entry(db_conn, id="k2", tags=json.dumps(["退货", "政策"]))

        entries = repo.query("m1", "s1", keywords=["退货"])
        assert len(entries) == 1
        assert entries[0]["id"] == "k2"

    def test_query_multiple_keywords_or_logic(self, repo, db_conn):
        insert_entry(db_conn, id="k1", title="发货时间", content="48小时")
        insert_entry(db_conn, id="k2", title="退货政策", content="7天")
        insert_entry(db_conn, id="k3", title="其他", content="无关内容")

        entries = repo.query("m1", "s1", keywords=["发货", "退货"])
        assert len(entries) == 2
        ids = {e["id"] for e in entries}
        assert ids == {"k1", "k2"}

    def test_query_filters_by_knowledge_type(self, repo, db_conn):
        insert_entry(db_conn, id="k1", knowledge_type="SHIPPING_TIME", title="发货时间")
        insert_entry(db_conn, id="k2", knowledge_type="FAQ", title="发货相关FAQ")

        entries = repo.query("m1", "s1", keywords=["发货"], knowledge_type="SHIPPING_TIME")
        assert len(entries) == 1
        assert entries[0]["knowledge_type"] == "SHIPPING_TIME"

    def test_query_defaults_to_active_status(self, repo, db_conn):
        insert_entry(db_conn, id="k1", status="ACTIVE", title="发货时间")
        insert_entry(db_conn, id="k2", status="DRAFT", title="发货草稿")

        entries = repo.query("m1", "s1", keywords=["发货"])
        assert len(entries) == 1
        assert entries[0]["status"] == "ACTIVE"

    def test_query_no_keywords_returns_all_active(self, repo, db_conn):
        insert_entry(db_conn, id="k1", status="ACTIVE")
        insert_entry(db_conn, id="k2", status="ACTIVE")
        insert_entry(db_conn, id="k3", status="DRAFT")

        entries = repo.query("m1", "s1")
        assert len(entries) == 2

    def test_query_no_matches_returns_empty(self, repo, db_conn):
        insert_entry(db_conn, id="k1", title="发货时间")

        entries = repo.query("m1", "s1", keywords=["不存在的关键词"])
        assert len(entries) == 0

    def test_query_enforces_merchant_scope(self, repo, db_conn):
        insert_entry(db_conn, id="k1", merchant_id="m1", title="发货时间")

        entries = repo.query("m2", "s1", keywords=["发货"])
        assert len(entries) == 0

    def test_query_respects_limit(self, repo, db_conn):
        for i in range(10):
            insert_entry(db_conn, id=f"k{i}", title=f"发货时间{i}")

        entries = repo.query("m1", "s1", keywords=["发货"], limit=3)
        assert len(entries) == 3

    def test_tags_parsed_from_json(self, repo, db_conn):
        insert_entry(db_conn, id="k1", tags=json.dumps(["tag1", "tag2"]))

        entry = repo.get("k1", "m1")
        assert entry is not None
        assert entry["tags"] == ["tag1", "tag2"]

    def test_tags_empty_on_invalid_json(self, repo, db_conn):
        insert_entry(db_conn, id="k1", tags="invalid json")

        entry = repo.get("k1", "m1")
        assert entry is not None
        assert entry["tags"] == []

    def test_invalid_knowledge_type_returns_empty(self, repo, db_conn):
        insert_entry(db_conn, id="k1")

        entries = repo.list("m1", "s1", knowledge_type="INVALID_TYPE")
        assert len(entries) == 0

    def test_invalid_status_returns_empty(self, repo, db_conn):
        insert_entry(db_conn, id="k1")

        entries = repo.list("m1", "s1", status="INVALID_STATUS")
        assert len(entries) == 0
