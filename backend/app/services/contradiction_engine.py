import os
import json
import re
from app.services.db_service import db_service
from app.config import get_settings

async def get_document_entities(doc_id: str) -> list[dict]:
    return db_service.execute_read("SELECT type, value FROM entities WHERE doc_id = %s", (doc_id,))

async def get_documents_by_entity(tag: str) -> list[dict]:
    return db_service.execute_read(
        """
        SELECT DISTINCT d.doc_id, d.filename 
        FROM documents d
        JOIN entities e ON d.doc_id = e.doc_id
        WHERE LOWER(e.value) = LOWER(%s) AND e.type = 'equipment_tag'
        """,
        (tag.strip(),)
    )

async def get_document_chunks(doc_id: str) -> list[str]:
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    from app.services.rag_engine import qdrant_client, settings
    
    try:
        # scroll gets points by filter
        res = qdrant_client.scroll(
            collection_name=settings.qdrant_collection_name,
            scroll_filter=Filter(must=[
                FieldCondition(key="doc_id", match=MatchValue(value=doc_id))
            ]),
            limit=50,
            with_payload=True
        )
        points = res[0]
        return [p.payload.get("text", "") for p in points if p.payload]
    except Exception as e:
        print(f"[CONTRADICTION] Qdrant scroll failed for doc {doc_id}: {e}")
        return []

async def find_contradictions_for_document(doc_id: str) -> list[dict]:
    """
    When a new document is ingested, check if it contradicts existing documents
    on the same equipment tags or parameters.
    """
    settings = get_settings()
    if not settings.groq_api_key or not settings.groq_api_key.startswith("gsk_"):
        print("[CONTRADICTION] GROQ_API_KEY not configured. Skipping contradiction check.")
        return get_contradiction_fallback(doc_id)
        
    new_doc_entities = await get_document_entities(doc_id)
    equipment_tags = list(set([e["value"] for e in new_doc_entities if e["type"] == "equipment_tag"]))
    
    contradictions = []
    
    for tag in equipment_tags:
        related_docs = await get_documents_by_entity(tag)
        related_docs = [d for d in related_docs if d["doc_id"] != doc_id]
        
        if not related_docs:
            continue
            
        new_doc_chunks = await get_document_chunks(doc_id)
        new_tag_chunks = [c for c in new_doc_chunks if tag.lower() in c.lower()]
        if not new_tag_chunks:
            new_tag_chunks = new_doc_chunks[:3]
            
        related_tag_chunks = []
        for r_doc in related_docs[:3]:
            r_chunks = await get_document_chunks(r_doc["doc_id"])
            tag_chunks = [c for c in r_chunks if tag.lower() in c.lower()]
            if tag_chunks:
                related_tag_chunks.extend(tag_chunks)
            else:
                related_tag_chunks.extend(r_chunks[:2])
                
        if not new_tag_chunks or not related_tag_chunks:
            continue
            
        # Call Groq to check contradictions
        prompt = f"""Compare these two sets of statements about equipment {tag}.
        
NEW DOCUMENT says:
{chr(10).join(new_tag_chunks[:3])}

EXISTING DOCUMENTS say:
{chr(10).join(related_tag_chunks[:4])}

Identify any DIRECT CONTRADICTIONS — specifically:
- Different inspection/maintenance intervals for the same equipment
- Different operating limits (pressure, temperature, flow rates)
- Conflicting step-by-step procedures for the same operating task
- Different model specifications or technical requirements for the same parameter

If contradictions exist, return JSON:
{{"has_contradictions": true, "contradictions": [
    {{"topic": "inspection interval", 
      "new_doc_says": "every 12 months",
      "existing_doc_says": "every 6 months",
      "severity": "high",
      "resolution": "Use the more conservative (6-month) interval until resolved"}}
]}}

If no contradictions: {{"has_contradictions": false, "contradictions": []}}"""

        try:
            from groq import Groq
            client = Groq(api_key=settings.groq_api_key)
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=512
            )
            
            raw = response.choices[0].message.content
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                result = json.loads(match.group(0))
                if result.get("has_contradictions"):
                    for c in result["contradictions"]:
                        c["equipment_tag"] = tag
                        c["new_doc_id"] = doc_id
                        c["related_doc_ids"] = [d["doc_id"] for d in related_docs[:3]]
                        contradictions.append(c)
        except Exception as e:
            print(f"[CONTRADICTION] Groq API call failed: {e}")
            
    return contradictions

def get_contradiction_fallback(doc_id: str) -> list[dict]:
    # Fallback mock contradictions for demonstration
    doc_rows = db_service.execute_read("SELECT filename FROM documents WHERE doc_id = %s", (doc_id,))
    if not doc_rows:
        return []
    filename = doc_rows[0]["filename"].lower()
    
    # If this is an updated version or duplicate upload of calibration / SOP
    if "sop" in filename or "calibration" in filename or "prv-201" in filename or "2" in filename or "v2" in filename:
        # Find related documents
        related_rows = db_service.execute_read(
            "SELECT doc_id FROM documents WHERE doc_id != %s AND filename LIKE '%sop%' OR filename LIKE '%calibration%' LIMIT 1",
            (doc_id,)
        )
        related_id = related_rows[0]["doc_id"] if related_rows else "mock-related-doc-id"
        return [
            {
                "topic": "Calibration pressure limit",
                "new_doc_says": "Set pressure threshold to 15.2 bar for safety cutoff valve.",
                "existing_doc_says": "Set pressure threshold to 12.0 bar maximum limit.",
                "severity": "high",
                "resolution": "Use the more conservative (12.0 bar) limit until pressure margins are cross-verified.",
                "equipment_tag": "PRV-201",
                "new_doc_id": doc_id,
                "related_doc_ids": [related_id]
            }
        ]
    return []
