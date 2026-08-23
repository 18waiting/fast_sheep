import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""LearningEngine (M10): stage order, products, pending write, archive."""
import unittest
from fastwork_ai_worker.learning.learning_engine import LearningEngine


class _Pending:
    def __init__(self):
        self.rows = []

    def upsert(self, row):
        self.rows.append(row)


class _Candidates:
    def __init__(self):
        self.rows = []

    def insert(self, row):
        self.rows.append(row)


class _Emb:
    def embed(self, texts):
        return [[1.0, 0.0]] * len(texts)


class _Gen:
    def generate(self, request):
        return {"qa": [{"q": "<标签>有XL吗", "a": "有的"}]}


class TestLearningEngine(unittest.TestCase):
    def test_stage_order(self):
        eng = LearningEngine(pending_repo=_Pending())
        res = eng.run({"import_source": "synthetic_chat.txt"})
        ops = [t["operation"] for t in res["trace"]]
        self.assertEqual(ops, ["CONVERSATION_IMPORT", "PRODUCT_EXTRACTION", "CANDIDATE_EXTRACT", "PENDING_WRITE", "INDEX_SIGNAL"])
        self.assertEqual(res["events"][0]["event"], "LearningProgress")

    def test_product_extraction(self):
        eng = LearningEngine()
        res = eng.run({"chat": "===商品id10001===\n[买家]这个多少钱\n[客服]99元"})
        self.assertEqual(res["products"], ["10001"])

    def test_pending_insert(self):
        p = _Pending()
        eng = LearningEngine(pending_repo=p)
        res = eng.run({"qa": [{"问题": "这个多少钱", "答案": "99元", "商品ID": "10001"}]})
        self.assertEqual(res["inserted"], 1)
        self.assertEqual(len(p.rows), 1)

    def test_finish_archive(self):
        eng = LearningEngine()
        res = eng.run({"command": "finish"})
        self.assertTrue(res["events"][0]["payload_subset"]["completed"])
        self.assertTrue(any(t["operation"] == "ARCHIVE" for t in res["trace"]))

    def test_refined_candidate_generated(self):
        c = _Candidates()
        eng = LearningEngine(candidate_repo=c, generation_provider=_Gen())
        eng.run({"segment": {"商品ID": "10001", "content": "[买家]有XL吗\n[客服]有的"}})
        self.assertEqual(len(c.rows), 1)
        self.assertEqual(c.rows[0]["origin"], "GENERATED")


if __name__ == "__main__":
    unittest.main()
