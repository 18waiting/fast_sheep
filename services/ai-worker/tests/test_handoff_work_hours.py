import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Work-hours gate (M9): inclusive boundaries, overnight, invalid empty."""
import unittest
from fastwork_ai_worker.handoff.work_hours import in_work_hours

class TestWorkHours(unittest.TestCase):
    def test_in_window(self):
        self.assertTrue(in_work_hours("08:00-23:00", 0, tz_offset_minutes=600))
        self.assertTrue(in_work_hours("08:00-23:00", 12 * 3600 * 1000))

    def test_outside(self):
        self.assertFalse(in_work_hours("08:00-23:00", 2 * 3600 * 1000))

    def test_overnight(self):
        self.assertTrue(in_work_hours("22:00-06:00", 1 * 3600 * 1000))

    def test_empty_invalid(self):
        self.assertIsNone(in_work_hours("", 0))
        self.assertIsNone(in_work_hours("bad", 0))

if __name__ == "__main__":
    unittest.main()
