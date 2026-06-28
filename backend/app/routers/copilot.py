import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.models.schemas import CopilotResponse, CopilotSource
from app.services.rag_engine import answer_query, get_session_history

router = APIRouter(tags=["Copilot"])

class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    top_k: Optional[int] = 5

@router.post("/copilot/query", response_model=CopilotResponse)
async def query_copilot(req: QueryRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    doc_type = None
    plant_id = None
    if req.filters:
        doc_type = req.filters.get("doc_type")
        plant_id = req.filters.get("plant_id")
        
    result = await answer_query(
        query=req.query,
        session_id=req.session_id,
        doc_type=doc_type,
        top_k=req.top_k or 5,
        plant_id=plant_id
    )
    
    # Map sources
    sources = []
    for src in result["sources"]:
        sources.append(CopilotSource(
            doc_id=src["doc_id"],
            filename=src["filename"],
            doc_type=src["doc_type"],
            page=src["page"],
            excerpt=src["excerpt"],
            relevance_score=src["relevance_score"]
        ))
        
    return CopilotResponse(
        session_id=result["session_id"],
        query=result["query"],
        answer=result["answer"],
        confidence_score=result["confidence_score"],
        confidence_label=result.get("confidence_label"),
        sources=sources,
        follow_up_suggestions=result["follow_up_suggestions"]
    )

@router.get("/copilot/sessions/{session_id}/history")
async def fetch_session_history(session_id: str):
    history = await get_session_history(session_id)
    # We should return a list of formatted messages
    results = []
    for h in history:
        # Convert timestamp to ISO format string
        ts = h["timestamp"]
        if isinstance(ts, datetime.datetime):
            ts = ts.isoformat()
            
        results.append({
            "role": h["role"],
            "content": h["content"],
            "timestamp": ts
        })
    return results
