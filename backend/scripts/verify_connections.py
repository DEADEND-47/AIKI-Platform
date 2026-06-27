# backend/scripts/verify_connections.py
"""
Run: python scripts/verify_connections.py
Verifies all 4 service connections before deploy.
All must show ✓ — fix any ✗ before continuing.
"""
import os
import sys
from dotenv import load_dotenv
load_dotenv()

results = {}

# Test Groq
print("Testing Groq API...", end=" ")
try:
    from groq import Groq
    client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
    response = client.chat.completions.create(
        model="llama3-70b-8192",
        messages=[{"role": "user", "content": "Reply with the single word: OK"}],
        max_tokens=5
    )
    assert "OK" in response.choices[0].message.content
    results["groq"] = "✓"
    print("✓")
except Exception as e:
    results["groq"] = f"✗ {e}"
    print(f"✗ {e}")

# Test Jina AI
print("Testing Jina AI Embeddings...", end=" ")
try:
    import httpx
    r = httpx.post(
        "https://api.jina.ai/v1/embeddings",
        headers={"Authorization": f"Bearer {os.environ.get('JINA_API_KEY', '')}"},
        json={"model": "jina-embeddings-v2-base-en", "input": ["test"]},
        timeout=15
    )
    r.raise_for_status()
    assert len(r.json()["data"][0]["embedding"]) == 768
    results["jina"] = "✓"
    print("✓")
except Exception as e:
    results["jina"] = f"✗ {e}"
    print(f"✗ {e}")

# Test Qdrant
print("Testing Qdrant Cloud...", end=" ")
try:
    from qdrant_client import QdrantClient
    qc = QdrantClient(
        url=os.environ.get("QDRANT_URL", ""),
        api_key=os.environ.get("QDRANT_API_KEY", ""),
        timeout=10
    )
    qc.get_collections()
    results["qdrant"] = "✓"
    print("✓")
except Exception as e:
    results["qdrant"] = f"✗ {e}"
    print(f"✗ {e}")

# Test Neo4j
print("Testing Neo4j AuraDB...", end=" ")
try:
    from neo4j import GraphDatabase
    driver = GraphDatabase.driver(
        os.environ.get("NEO4J_URI", ""),
        auth=(os.environ.get("NEO4J_USER", "neo4j"), os.environ.get("NEO4J_PASSWORD", ""))
    )
    with driver.session() as session:
        result = session.run("RETURN 'connected' AS status")
        assert result.single()["status"] == "connected"
    driver.close()
    results["neo4j"] = "✓"
    print("✓")
except Exception as e:
    results["neo4j"] = f"✗ {e}"
    print(f"✗ {e}")

# Summary
print("\n" + "─" * 40)
all_ok = all(v == "✓" for v in results.values())
for service, status in results.items():
    print(f"  {service:10} {status}")
print("─" * 40)
if all_ok:
    print("  All services connected. Ready to deploy. ✓")
    sys.exit(0)
else:
    print("  Fix the ✗ items above before deploying.")
    sys.exit(1)
