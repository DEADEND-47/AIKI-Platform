import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import documents, graph, copilot, compliance, auth, ws, equipment, insights, analytics
from app.services.db_service import db_service
from app.services.graph_service import graph_service

settings = get_settings()
os.makedirs(settings.upload_dir, exist_ok=True)

app = FastAPI(
    title="AIKI — Asset & Operations Brain",
    description="AI-powered industrial knowledge intelligence platform",
    version="1.0.0"
)

# CORS configurations
origins = settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1")
app.include_router(copilot.router, prefix="/api/v1")
app.include_router(compliance.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(equipment.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(ws.router)

import asyncio
import httpx
import time

@app.on_event("startup")
async def startup_event():
    # Initialize SQL database tables
    db_service.init_db()
    # Initialize Neo4j constraints
    graph_service.init_constraints()
    
    # Start Keepalive Loop to prevent Render cold starts
    async def keepalive_loop():
        await asyncio.sleep(60)  # Wait for server to fully start
        port = os.environ.get("PORT", "8000")
        while True:
            try:
                async with httpx.AsyncClient() as client:
                    await client.get(
                        f"http://localhost:{port}/api/v1/health",
                        timeout=10
                    )
            except Exception:
                pass  # Never crash on keepalive failure
            await asyncio.sleep(600)  # Ping every 10 minutes

    asyncio.create_task(keepalive_loop())

@app.middleware("http")
async def add_timing_header(request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 1)
    response.headers["X-Response-Time-Ms"] = str(duration_ms)
    return response

@app.get("/api/v1/health")
async def health_check():
    services = {}
    overall_healthy = True

    # Qdrant
    try:
        if settings.qdrant_url and settings.qdrant_api_key:
            from qdrant_client import QdrantClient
            qc = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key, timeout=5)
            qc.get_collections()
            services["vector_store"] = "healthy"
        else:
            services["vector_store"] = "degraded: using in-memory fallback"
            overall_healthy = False
    except Exception as e:
        services["vector_store"] = f"unhealthy: {str(e)[:60]}"
        overall_healthy = False

    # Neo4j
    try:
        if settings.neo4j_uri and settings.neo4j_password:
            from neo4j import GraphDatabase
            d = GraphDatabase.driver(settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password))
            with d.session() as s:
                s.run("RETURN 1")
            d.close()
            services["knowledge_graph"] = "healthy"
        else:
            services["knowledge_graph"] = "degraded: using sqlite fallback"
            overall_healthy = False
    except Exception as e:
        services["knowledge_graph"] = f"unhealthy: {str(e)[:60]}"
        overall_healthy = False

    # Groq
    if settings.groq_api_key and settings.groq_api_key.startswith("gsk_"):
        services["llm"] = "healthy"
    else:
        services["llm"] = "degraded: no valid GROQ_API_KEY"
        overall_healthy = False

    # PostgreSQL
    try:
        # PostgreSQL checks
        if settings.database_url and "postgresql" in settings.database_url:
            from app.services.db_service import db_service
            # If postgres is active on DBService, test query
            if db_service.use_postgres:
                db_service.execute_read("SELECT 1")
                services["database"] = "healthy"
            else:
                services["database"] = "degraded: postgres url provided but sqlite in use"
                overall_healthy = False
        else:
            services["database"] = "degraded: using sqlite fallback"
            overall_healthy = False
    except Exception as e:
        services["database"] = f"unhealthy: {str(e)[:60]}"
        overall_healthy = False

    return {
        "status": "healthy" if overall_healthy else "degraded",
        "version": "1.0.0",
        "services": services
    }

@app.on_event("startup")
async def startup_event():
    from app.services.scheduler import start_scheduler
    start_scheduler()
    print("[STARTUP] Compliance scheduler initialized successfully.")
