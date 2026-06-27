import os
import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, Query
from pydantic import ValidationError

from app.config import get_settings
from app.models.schemas import DocumentMetadata, JobStatus, DocType, Entity
from app.services.db_service import db_service
from app.services.ingestion import process_ingestion_job

settings = get_settings()
router = APIRouter(tags=["Documents"])

@router.post("/documents/upload", status_code=202)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    doc_type: DocType = Form(...),
    tags: Optional[str] = Form(None)  # comma separated list
):
    job_id = str(uuid.uuid4())
    upload_path = os.path.join(settings.upload_dir, job_id)
    os.makedirs(upload_path, exist_ok=True)
    
    # Parse tags
    tags_list = []
    if tags:
        tags_list = [t.strip() for t in tags.split(",") if t.strip()]
        
    saved_files = []
    for file in files:
        file_path = os.path.join(upload_path, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())
            
        saved_files.append({
            "filename": file.filename,
            "local_path": file_path
        })
        
    # Create Ingestion Job in SQL DB
    db_service.execute_write(
        """
        INSERT INTO jobs (job_id, status, file_count, progress)
        VALUES (%s, %s, %s, %s)
        """,
        (job_id, "queued", len(saved_files), 0)
    )
    
    # Start Background Ingestion Task
    background_tasks.add_task(
        process_ingestion_job,
        job_id=job_id,
        files_info=saved_files,
        doc_type=doc_type.value,
        tags=tags_list
    )
    
    return {
        "job_id": job_id,
        "status": "queued",
        "file_count": len(saved_files),
        "message": "Documents queued for processing"
    }

@router.get("/documents/status/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    rows = db_service.execute_read(
        "SELECT job_id, status, progress, documents_processed, entities_extracted, error FROM jobs WHERE job_id = %s",
        (job_id,)
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Job not found")
        
    row = rows[0]
    return JobStatus(
        job_id=row["job_id"],
        status=row["status"],
        progress=row["progress"],
        documents_processed=row["documents_processed"] or 0,
        entities_extracted=row["entities_extracted"] or 0,
        error=row["error"]
    )

@router.get("/documents", response_model=List[DocumentMetadata])
async def list_documents(
    doc_type: Optional[DocType] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1)
):
    offset = (page - 1) * page_size
    query = "SELECT doc_id, filename, doc_type, upload_timestamp, status, entity_count, tags FROM documents"
    params = []
    
    if doc_type:
        query += " WHERE doc_type = %s"
        params.append(doc_type.value)
        
    query += " ORDER BY upload_timestamp DESC LIMIT %s OFFSET %s"
    params.extend([page_size, offset])
    
    rows = db_service.execute_read(query, tuple(params))
    
    docs = []
    for r in rows:
        # Convert timestamp to datetime object if string
        ts = r["upload_timestamp"]
        if isinstance(ts, str):
            try:
                # Remove Z or split +
                ts = ts.replace("Z", "")
                if "." in ts:
                    ts = ts.split(".")[0]
                ts = datetime.datetime.fromisoformat(ts)
            except Exception:
                ts = datetime.datetime.utcnow()
                
        # Parse tags
        tags_raw = r["tags"]
        tags_list = []
        if tags_raw:
            if isinstance(tags_raw, list):
                tags_list = tags_raw
            elif isinstance(tags_raw, str):
                tags_list = [t.strip() for t in tags_raw.split(",") if t.strip()]
                
        docs.append(DocumentMetadata(
            doc_id=r["doc_id"],
            filename=r["filename"],
            doc_type=DocType(r["doc_type"]),
            upload_timestamp=ts,
            status=r["status"],
            entity_count=r["entity_count"] or 0,
            tags=tags_list
        ))
    return docs

@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    doc_rows = db_service.execute_read(
        "SELECT doc_id, filename, doc_type, upload_timestamp, status, entity_count, tags, page_count FROM documents WHERE doc_id = %s",
        (doc_id,)
    )
    if not doc_rows:
        raise HTTPException(status_code=404, detail="Document not found")
        
    doc = doc_rows[0]
    
    # Fetch extracted entities
    ent_rows = db_service.execute_read(
        "SELECT entity_id, type, value, context, page, confidence FROM entities WHERE doc_id = %s",
        (doc_id,)
    )
    
    entities = []
    for e in ent_rows:
        entities.append({
            "entity_id": e["entity_id"],
            "type": e["type"],
            "value": e["value"],
            "context": e["context"],
            "page": e["page"],
            "confidence": e["confidence"]
        })
        
    # Format tags
    tags_raw = doc["tags"]
    tags_list = []
    if tags_raw:
        if isinstance(tags_raw, list):
            tags_list = tags_raw
        elif isinstance(tags_raw, str):
            tags_list = [t.strip() for t in tags_raw.split(",") if t.strip()]
            
    # Format timestamp
    ts = doc["upload_timestamp"]
    if isinstance(ts, str):
        try:
            ts = ts.replace("Z", "")
            if "." in ts:
                ts = ts.split(".")[0]
            ts = datetime.datetime.fromisoformat(ts)
        except Exception:
            ts = datetime.datetime.utcnow()
            
    return {
        "metadata": {
            "doc_id": doc["doc_id"],
            "filename": doc["filename"],
            "doc_type": doc["doc_type"],
            "upload_timestamp": ts,
            "status": doc["status"],
            "entity_count": doc["entity_count"] or 0,
            "page_count": doc["page_count"] or 0,
            "tags": tags_list
        },
        "entities": entities
    }
