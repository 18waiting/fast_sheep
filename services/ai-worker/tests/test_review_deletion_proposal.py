import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Review deletion proposal (M10): 4-layer JSON repair."""
import unittest
from fastwork_ai_worker.review.deletion_proposal import parse_delete_list


class TestDeletionProposal(unittest.TestCase):
    def test_markdown_strip(self):
        r = parse_delete_list("```json\n[{...}]```")
        self.assertEqual(r[0]["parse_strategy"], "markdown_strip")
        self.assertEqual(r[0]["entries"], 1)

    def test_direct_json(self):
        r = parse_delete_list('[{"商品ID": "10001", "问题": "q", "答案": "a"}]')
        self.assertEqual(r[0]["entries"], 1)

    def test_empty_array_no_deletions(self):
        self.assertEqual(parse_delete_list("[]"), [])

    def test_garbage_no_deletions(self):
        self.assertEqual(parse_delete_list("not json at all"), [])


if __name__ == "__main__":
    unittest.main()
