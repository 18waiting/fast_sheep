"""M2 cancellation registry tests."""
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rpc.cancellation import CancellationRegistry


class TestCancellationRegistry(unittest.TestCase):
    def test_register_remove(self):
        async def scenario():
            reg = CancellationRegistry()
            task = asyncio.create_task(asyncio.sleep(10))
            self.assertTrue(reg.register("r1", task))
            self.assertFalse(reg.register("r1", task))  # duplicate
            self.assertEqual(reg.active_ids(), ["r1"])
            reg.remove("r1")
            self.assertEqual(reg.active_ids(), [])
            task.cancel()
        asyncio.run(scenario())

    def test_cancel_cancels_task(self):
        async def scenario():
            reg = CancellationRegistry()
            cancelled = []
            async def worker():
                try:
                    await asyncio.sleep(10)
                except asyncio.CancelledError:
                    cancelled.append(True)
                    raise
            task = asyncio.create_task(worker())
            reg.register("r1", task)
            await asyncio.sleep(0.05)  # let the task start
            self.assertTrue(reg.cancel("r1"))
            await asyncio.sleep(0.05)
            self.assertEqual(cancelled, [True])
            reg.remove("r1")
            self.assertFalse(reg.cancel("r1"))
        asyncio.run(scenario())

    def test_cancel_all(self):
        async def scenario():
            reg = CancellationRegistry()
            t1 = asyncio.create_task(asyncio.sleep(10))
            t2 = asyncio.create_task(asyncio.sleep(10))
            reg.register("a", t1)
            reg.register("b", t2)
            self.assertEqual(reg.cancel_all(), 2)
            await asyncio.sleep(0.05)
        asyncio.run(scenario())


if __name__ == "__main__":
    unittest.main()
