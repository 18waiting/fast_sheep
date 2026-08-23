import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Effect mapper (M9): intent class -> knowledge effect."""
import unittest
from fastwork_ai_worker.feedback.effect_mapper import map_effect
from fastwork_ai_worker.feedback.types import FeedbackApplyRequest

def req(cls, **kw):
    return FeedbackApplyRequest(record_id="r", class_name=cls, **kw)

class TestEffectMapper(unittest.TestCase):
    def test_auto(self):
        e = map_effect(req("AUTO"))
        self.assertEqual((e.op, e.trust), ("append", "AUTO"))

    def test_manual(self):
        e = map_effect(req("MANUAL"))
        self.assertEqual((e.op, e.trust), ("append", "HUMAN_CONFIRMED"))

    def test_no_save(self):
        e = map_effect(req("NO_SAVE"))
        self.assertEqual(e.op, "none")

    def test_correction_audit(self):
        self.assertEqual(map_effect(req("CORRECTION")).index_refresh, "incremental")
        self.assertEqual(map_effect(req("AUDIT_APPROVE")).trust, "HUMAN_CONFIRMED")

    def test_restore(self):
        e = map_effect(req("RESTORE"))
        self.assertEqual((e.op, e.index_refresh), ("append", "deferred"))

if __name__ == "__main__":
    unittest.main()
