import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from app.services.db_service import db_service

router = APIRouter(tags=["Equipment"])

@router.get("/equipment/{tag}/timeline")
async def get_equipment_timeline(tag: str, plant_id: Optional[str] = Query(None)):
    if not tag.strip():
        raise HTTPException(status_code=400, detail="Tag cannot be empty")
        
    query = """
        SELECT e.entity_id, e.doc_id, e.type, e.value, e.context, e.page, e.confidence,
               d.filename, d.doc_type, d.upload_timestamp, d.version
        FROM entities e
        JOIN documents d ON e.doc_id = d.doc_id
        WHERE LOWER(e.value) = LOWER(%s) AND e.type = 'equipment_tag'
    """
    params = [tag.strip()]
    
    if plant_id and plant_id != "all":
        query += " AND d.plant_id = %s"
        params.append(plant_id)
        
    query += " ORDER BY d.upload_timestamp DESC"
    
    rows = db_service.execute_read(query, tuple(params))
    
    timeline = []
    for r in rows:
        ts = r["upload_timestamp"]
        if isinstance(ts, str):
            try:
                ts = ts.replace("Z", "").split(".")[0]
                ts = datetime.datetime.fromisoformat(ts)
            except Exception:
                ts = datetime.datetime.utcnow()
                
        timeline.append({
            "doc_id": r["doc_id"],
            "filename": r["filename"],
            "doc_type": r["doc_type"],
            "upload_timestamp": ts,
            "version": r["version"],
            "page": r["page"],
            "context": r["context"],
            "confidence": r["confidence"]
        })
        
    return timeline
