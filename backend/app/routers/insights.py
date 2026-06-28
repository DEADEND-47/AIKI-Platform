from fastapi import APIRouter, Query
from typing import Optional
from app.services.insights_engine import generate_daily_insights

router = APIRouter(tags=["Insights"])

@router.get("/insights")
async def get_insights(plant_id: Optional[str] = Query(None)):
    return await generate_daily_insights(plant_id)
