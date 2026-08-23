"""M2 RPC protocol envelope validation tests (TASK-017)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rpc import protocol as proto
from fastwork_ai_worker.rpc.errors import WorkerRpcError


class TestProtocolValidation(unittest.TestCase):
    def test_request_valid(self):
        req = {
            "version": 1,
            "request_id": "r1",
            "method": "ping",
            "payload": {},
            "context": {"shop_id": "s1", "correlation_id": "c1"},
        }
        ok, errs = proto.validate_request(req)
        self.assertTrue(ok, errs)

    def test_request_missing_version_rejected(self):
        ok, errs = proto.validate_request({"request_id": "r1", "method": "ping", "payload": {}})
        self.assertFalse(ok)

    def test_response_valid(self):
        ok, errs = proto.validate_response({"request_id": "r1", "ok": True, "result": {}, "error": None})
        self.assertTrue(ok, errs)

    def test_response_error_valid(self):
        ok, errs = proto.validate_response(
            {"request_id": "r1", "ok": False, "result": None, "error": {"code": "c", "category": "internal", "message": "m", "retryable": False}}
        )
        self.assertTrue(ok, errs)

    def test_event_valid(self):
        ok, errs = proto.validate_event({"event": "worker.ready", "payload": {}, "correlation_id": "c1"})
        self.assertTrue(ok, errs)

    def test_ready_payload_valid(self):
        ok, errs = proto.validate_ready_payload(
            {"version": 1, "worker_version": "0.0.0", "protocol_versions": [1], "pid": 1, "python_version": "3.12.7", "capabilities": []}
        )
        self.assertTrue(ok, errs)

    def test_ready_payload_missing_capabilities_rejected(self):
        ok, _ = proto.validate_ready_payload({"worker_version": "0.0.0", "protocol_versions": [1], "pid": 1, "python_version": "3.12"})
        self.assertFalse(ok)

    def test_health_result_valid(self):
        ok, errs = proto.validate_health_result({"status": "ok", "worker_version": "0.0.0", "protocol_version": 1, "pid": 1, "uptime_ms": 0})
        self.assertTrue(ok, errs)

    def test_cancel_payload_valid(self):
        ok, errs = proto.validate_cancel_payload({"target_request_id": "r1"})
        self.assertTrue(ok, errs)

    def test_protocol_error_payload_valid(self):
        ok, errs = proto.validate_protocol_error_payload({"reason": "malformed"})
        self.assertTrue(ok, errs)

    def test_version_supported(self):
        proto.assert_version_supported({"version": 1})

    def test_version_unsupported_raises(self):
        with self.assertRaises(WorkerRpcError) as ctx:
            proto.assert_version_supported({"version": 99})
        self.assertEqual(ctx.exception.code, "version.unsupported")


if __name__ == "__main__":
    unittest.main()
