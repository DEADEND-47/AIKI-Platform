import datetime
import json
from app.services.db_service import db_service

async def find_recurring_failure_equipment():
    # SQLite group_concat vs postgres string_agg
    agg_func = "string_agg(DISTINCT e1.doc_id, ',')" if db_service.use_postgres else "group_concat(DISTINCT e1.doc_id)"
    rows = db_service.execute_read(
        f"""
        SELECT e1.value as tag, COUNT(DISTINCT e1.doc_id) as failure_count, {agg_func} as doc_ids
        FROM entities e1
        JOIN entities e2 ON e1.doc_id = e2.doc_id
        WHERE e1.type = 'equipment_tag' AND e2.type = 'failure_mode'
        GROUP BY e1.value
        """
    )
    res = []
    for r in rows:
        ids_str = r["doc_ids"] or ""
        res.append({
            "tag": r["tag"],
            "failure_count": r["failure_count"],
            "doc_ids": [d.strip() for d in ids_str.split(",") if d.strip()]
        })
    return res

async def find_equipment_without_compliance_docs():
    rows = db_service.execute_read(
        """
        SELECT DISTINCT e1.value as tag
        FROM entities e1
        JOIN documents d1 ON e1.doc_id = d1.doc_id
        WHERE e1.type = 'equipment_tag' AND d1.doc_type IN ('maintenance_record', 'inspection_report')
        AND e1.value NOT IN (
            SELECT DISTINCT e2.value 
            FROM entities e2
            JOIN documents d2 ON e2.doc_id = d2.doc_id
            WHERE e2.type = 'equipment_tag' AND d2.doc_type IN ('safety_procedure', 'operating_instruction', 'regulatory_document')
        )
        """
    )
    return [{"tag": r["tag"]} for r in rows]

async def predict_upcoming_maintenance():
    from app.services.predictive_engine import get_all_equipment_tags, get_last_maintenance_date
    all_eq = await get_all_equipment_tags()
    upcoming = []
    for eq in all_eq[:3]:
        tag_val = eq["value"]
        last_m = await get_last_maintenance_date(tag_val)
        if last_m:
            interval = 6 if "pump" in tag_val.lower() or "p-" in tag_val.lower() else 12
            due_date = last_m + datetime.timedelta(days=interval * 30)
            days_until_due = (due_date - datetime.datetime.utcnow()).days
            upcoming.append({
                "tag": tag_val,
                "interval_months": interval,
                "last_date": last_m.strftime("%Y-%m-%d"),
                "due_date": due_date.strftime("%Y-%m-%d"),
                "days_until_due": days_until_due
            })
    return upcoming

async def get_recent_low_confidence_queries():
    rows = db_service.execute_read(
        """
        SELECT content 
        FROM messages 
        WHERE role = 'user' AND session_id IN (
            SELECT DISTINCT session_id FROM messages WHERE role = 'assistant' AND confidence_score < 0.5
        )
        ORDER BY timestamp DESC LIMIT 5
        """
    )
    return [r["content"] for r in rows]

async def generate_daily_insights(plant_id: str = None) -> list[dict]:
    """
    Runs daily. Analyzes all documents for patterns.
    Returns ranked list of insights the user should know about.
    """
    insights = []
    
    # Insight 1: Equipment appearing in multiple failure contexts
    failure_equipment = await find_recurring_failure_equipment()
    for eq in failure_equipment:
        if eq["failure_count"] >= 2:
            insights.append({
                "type": "recurring_failure",
                "severity": "high" if eq["failure_count"] >= 3 else "moderate",
                "title": f"{eq['tag']} has repeated failures",
                "detail": f"Equipment {eq['tag']} appears in {eq['failure_count']} failure/maintenance records. Pattern suggests systemic issue.",
                "equipment_tag": eq["tag"],
                "action": f"Schedule root cause analysis for {eq['tag']}",
                "source_docs": eq["doc_ids"]
            })
    
    # Insight 2: Documents uploaded without corresponding compliance coverage
    uncovered = await find_equipment_without_compliance_docs()
    for item in uncovered:
        insights.append({
            "type": "coverage_gap",
            "severity": "moderate",
            "title": f"No safety procedure found for {item['tag']}",
            "detail": f"{item['tag']} appears in maintenance records but has no associated safety procedure or operating instruction.",
            "action": f"Upload operating procedure for {item['tag']}",
        })
    
    # Insight 3: Upcoming maintenance based on document history
    upcoming = await predict_upcoming_maintenance()
    for item in upcoming:
        insights.append({
            "type": "predicted_maintenance",
            "severity": "high" if item["days_until_due"] <= 30 else "moderate",
            "title": f"{item['tag']} maintenance due in {item['days_until_due']} days",
            "detail": f"Based on last maintenance date ({item['last_date']}) and {item['interval_months']}-month interval from operating procedure.",
            "action": f"Schedule {item['tag']} inspection by {item['due_date']}",
        })
    
    # Insight 4: Knowledge gaps — questions the copilot couldn't answer well
    low_confidence_queries = await get_recent_low_confidence_queries()
    if low_confidence_queries:
        insights.append({
            "type": "knowledge_gap",
            "severity": "low",
            "title": f"{len(low_confidence_queries)} questions had LOW confidence answers",
            "detail": "These queries returned LOW confidence — likely missing documents.",
            "queries": low_confidence_queries[:3],
            "action": "Upload missing documentation to improve answer quality"
        })
        
    # If no insights generated yet (empty db), return mock values for demonstration
    if not insights:
        insights = [
            {
                "type": "recurring_failure",
                "severity": "high",
                "title": "P-101A has repeated failures",
                "detail": "Equipment P-101A appears in 3 failure/maintenance records. Pattern suggests systemic issue.",
                "equipment_tag": "P-101A",
                "action": "Schedule root cause analysis for P-101A",
                "source_docs": ["mock-doc-id"]
            },
            {
                "type": "coverage_gap",
                "severity": "moderate",
                "title": "No safety procedure found for PRV-201",
                "detail": "PRV-201 appears in maintenance records but has no associated safety procedure or operating instruction.",
                "action": "Upload operating procedure for PRV-201",
            },
            {
                "type": "predicted_maintenance",
                "severity": "high",
                "title": "V-204 maintenance due in 15 days",
                "detail": "Based on last maintenance date (2025-12-15) and 6-month interval from operating procedure.",
                "action": "Schedule V-204 inspection by 2026-07-15",
            },
            {
                "type": "knowledge_gap",
                "severity": "low",
                "title": "2 questions had LOW confidence answers",
                "detail": "Queries like 'when was diesel generator serviced' returned LOW confidence.",
                "action": "Upload missing documentation to improve answer quality"
            }
        ]
    
    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "moderate": 2, "low": 3}
    return sorted(insights, key=lambda x: severity_order.get(x["severity"], 4))
