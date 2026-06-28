from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException
from app.models.schemas import EntityType
from app.services.graph_service import graph_service

router = APIRouter(tags=["Graph"])

@router.get("/graph/entities")
async def list_entities(
    type: Optional[EntityType] = None,
    search: Optional[str] = Query(None, description="Search term for entity value"),
    limit: int = Query(50, ge=1, le=100)
):
    type_val = type.value if type else None
    results = graph_service.search_entities(ent_type=type_val, search=search, limit=limit)
    return results

@router.get("/graph/entities/{entity_id}/relationships")
async def get_entity_relationships(entity_id: str):
    result = graph_service.get_entity_relationships(entity_id)
    if not result or result.get("value") == "Unknown":
        raise HTTPException(status_code=404, detail="Entity not found or has no relationships")
    return result

@router.get("/graph/full")
async def get_full_graph(limit: int = Query(200, ge=1, le=500)):
    return graph_service.get_full_graph(limit=limit)
