import os
import sys
import unittest
import json
from fastapi.testclient import TestClient

# Add app to path
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.main import app
from app.config import get_settings
from app.services.db_service import db_service
from app.services.graph_service import graph_service

client = TestClient(app)

class TestAIKIBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Ensure database is clean or set up
        print("[TEST] Setting up test environment...")
        db_service.init_db()

    def test_health_check(self):
        print("[TEST] Testing /api/v1/health...")
        response = client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn(data["status"], ("healthy", "degraded"))
        self.assertIn("services", data)
        self.assertIn("vector_store", data["services"])
        print(f"[TEST] Health check: {data}")

    def test_regulations_list(self):
        print("[TEST] Checking if regulations data is available...")
        reg_path = os.path.join(os.path.dirname(__file__), "app", "data", "regulations.json")
        self.assertTrue(os.path.exists(reg_path))
        with open(reg_path, "r") as f:
            data = json.load(f)
        self.assertIn("rules", data)
        self.assertGreaterEqual(len(data["rules"]), 20)
        print(f"[TEST] Regulations rules count: {len(data['rules'])}")

    def test_copilot_demo_query_cache(self):
        print("[TEST] Testing /api/v1/copilot/query cache fallback...")
        query_payload = {
            "query": "What is the maintenance history of pump P-101A?",
            "top_k": 5
        }
        response = client.post("/api/v1/copilot/query", json=query_payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["confidence_score"], 0.95)
        self.assertIn("Source: work_order_WO-2024-0892.pdf", data["answer"])
        self.assertGreater(len(data["sources"]), 0)
        print(f"[TEST] Copilot response: {data['answer'][:100]}...")

    def test_compliance_fallback_scan(self):
        print("[TEST] Testing /api/v1/compliance/scan endpoint...")
        scan_payload = {
            "regulations": ["OISD-118", "Factory Act"]
        }
        response = client.post("/api/v1/compliance/scan", json=scan_payload)
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertIn("scan_id", data)
        self.assertEqual(data["status"], "queued")
        print(f"[TEST] Compliance scan initiated: {data}")

if __name__ == "__main__":
    unittest.main()
