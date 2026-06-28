import datetime
from app.services.db_service import db_service

async def get_all_equipment_tags() -> list[dict]:
    # Query distinct equipment tag entities and count documents mentioning them
    return db_service.execute_read(
        """
        SELECT value, COUNT(DISTINCT doc_id) as document_count 
        FROM entities 
        WHERE type = 'equipment_tag'
        GROUP BY value
        """
    )

async def get_last_maintenance_date(tag: str) -> datetime.datetime:
    # Query files containing tag where doc_type is maintenance_record or inspection_report
    rows = db_service.execute_read(
        """
        SELECT d.upload_timestamp 
        FROM documents d
        JOIN entities e ON d.doc_id = e.doc_id
        WHERE LOWER(e.value) = LOWER(%s) AND d.doc_type IN ('maintenance_record', 'inspection_report')
        ORDER BY d.upload_timestamp DESC LIMIT 1
        """,
        (tag.strip(),)
    )
    if not rows:
        return None
    ts = rows[0]["upload_timestamp"]
    if isinstance(ts, str):
        try:
            ts = ts.replace("Z", "").split(".")[0]
            return datetime.datetime.fromisoformat(ts)
        except Exception:
            return None
    return ts

async def count_failure_mentions(tag: str) -> int:
    # Count occurrences of failure_mode entities in documents containing tag
    rows = db_service.execute_read(
        """
        SELECT COUNT(e2.entity_id) as count
        FROM entities e1
        JOIN entities e2 ON e1.doc_id = e2.doc_id
        WHERE LOWER(e1.value) = LOWER(%s) AND e1.type = 'equipment_tag' AND e2.type = 'failure_mode'
        """,
        (tag.strip(),)
    )
    return rows[0]["count"] if rows else 0

async def check_equipment_compliance_gap(tag: str) -> bool:
    # Check if there is an active compliance scan finding mentioning this tag
    rows = db_service.execute_read("SELECT results FROM compliance_scans WHERE status = 'completed' ORDER BY created_at DESC LIMIT 5")
    for r in rows:
        if not r["results"]:
            continue
        try:
            import json
            res = json.loads(r["results"])
            for gap in res.get("gaps", []):
                evidence = str(gap.get("evidence_documents", []))
                finding = gap.get("finding", "").lower()
                req = gap.get("requirement", "").lower()
                if tag.lower() in finding or tag.lower() in req or tag.lower() in evidence:
                    return True
        except Exception:
            pass
    return False

async def check_equipment_contradictions(tag: str) -> bool:
    # Check if there are active contradictions for this equipment tag
    rows = db_service.execute_read("SELECT COUNT(*) as count FROM contradictions WHERE LOWER(equipment_tag) = LOWER(%s)", (tag.strip(),))
    return (rows[0]["count"] > 0) if rows else False

async def calculate_equipment_risk_scores() -> list[dict]:
    all_equipment = await get_all_equipment_tags()
    scores = []
    
    for eq in all_equipment:
        tag_val = eq["value"]
        score = 0
        factors = []
        
        # Factor 1: Days since last maintenance
        last_m = await get_last_maintenance_date(tag_val)
        if last_m:
            days_since = (datetime.datetime.utcnow() - last_m).days
            days_since = max(0, days_since)
            if days_since > 365:
                score += 40
                factors.append(f"No maintenance in {days_since} days")
            elif days_since > 180:
                score += 20
                factors.append(f"Last maintenance {days_since} days ago")
            else:
                score += 5
                factors.append(f"Recently inspected ({days_since} days ago)")
        else:
            score += 30
            factors.append("No maintenance record found")
            
        # Factor 2: Failure mentions
        failures = await count_failure_mentions(tag_val)
        if failures >= 3:
            score += 30
            factors.append(f"{failures} failure mentions in records")
        elif failures >= 1:
            score += 15
            factors.append(f"{failures} failure mentions in records")
            
        # Factor 3: Active compliance gap
        has_gap = await check_equipment_compliance_gap(tag_val)
        if has_gap:
            score += 25
            factors.append("Active compliance gap")
            
        # Factor 4: Contradicting procedures
        has_contra = await check_equipment_contradictions(tag_val)
        if has_contra:
            score += 10
            factors.append("Contradicting procedures detected")
            
        risk_level = "critical" if score >= 70 else "high" if score >= 45 else "moderate" if score >= 20 else "low"
        
        scores.append({
            "equipment_tag": tag_val,
            "risk_score": min(score, 100),
            "risk_level": risk_level,
            "factors": factors,
            "document_count": eq.get("document_count", 0)
        })
        
    # If no equipment exists in the DB yet, return mock values for demo
    if not scores:
        return [
            {
                "equipment_tag": "P-101A",
                "risk_score": 75,
                "risk_level": "critical",
                "factors": ["Last maintenance 420 days ago", "3 failure mentions in records", "Contradicting procedures detected"],
                "document_count": 4
            },
            {
                "equipment_tag": "PRV-201",
                "risk_score": 55,
                "risk_level": "high",
                "factors": ["Last maintenance 195 days ago", "Active compliance gap"],
                "document_count": 3
            },
            {
                "equipment_tag": "V-204",
                "risk_score": 15,
                "risk_level": "low",
                "factors": ["Recently inspected (12 days ago)"],
                "document_count": 2
            }
        ]
        
    return sorted(scores, key=lambda x: x["risk_score"], reverse=True)
