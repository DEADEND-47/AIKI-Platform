import json
import uuid
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.models.schemas import ScanResult, ComplianceGap, ScanSummary
from app.services.db_service import db_service
from app.services.compliance_engine import run_compliance_scan_task

router = APIRouter(tags=["Compliance"])

class ScanRequest(BaseModel):
    regulations: List[str]
    scope: Optional[Dict[str, Any]] = None

@router.post("/compliance/scan", status_code=202)
async def start_compliance_scan(req: ScanRequest, background_tasks: BackgroundTasks):
    scan_id = str(uuid.uuid4())
    
    # Save scan to DB
    db_service.execute_write(
        """
        INSERT INTO compliance_scans (scan_id, status, regulations, results)
        VALUES (%s, %s, %s, %s)
        """,
        (scan_id, "queued", ",".join(req.regulations), None)
    )
    
    # Start Background Task
    background_tasks.add_task(
        run_compliance_scan_task,
        scan_id=scan_id,
        target_regulations=req.regulations
    )
    
    return {
        "scan_id": scan_id,
        "status": "queued",
        "estimated_duration_seconds": 40
    }

@router.get("/compliance/scans/{scan_id}", response_model=ScanResult)
async def get_compliance_scan(scan_id: str):
    rows = db_service.execute_read(
        "SELECT scan_id, status, created_at, results FROM compliance_scans WHERE scan_id = %s",
        (scan_id,)
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Scan not found")
        
    row = rows[0]
    status = row["status"]
    
    # Format timestamp
    ts = row["created_at"]
    if isinstance(ts, str):
        try:
            ts = ts.replace("Z", "")
            if "." in ts:
                ts = ts.split(".")[0]
            ts = datetime.datetime.fromisoformat(ts)
        except Exception:
            ts = datetime.datetime.utcnow()
            
    if status == "queued" or status == "processing" or not row["results"]:
        return ScanResult(
            scan_id=row["scan_id"],
            status=status,
            scanned_at=ts,
            summary=None,
            gaps=[]
        )
        
    results = json.loads(row["results"])
    summary_data = results["summary"]
    gaps_data = results["gaps"]
    
    # Map gaps
    gaps = []
    for g in gaps_data:
        gaps.append(ComplianceGap(
            gap_id=g["gap_id"],
            regulation=g["regulation"],
            clause=g["clause"],
            requirement=g["requirement"],
            severity=g["severity"],
            status=g["status"],
            finding=g["finding"],
            recommended_action=g["recommended_action"],
            evidence_documents=g["evidence_documents"]
        ))
        
    summary = ScanSummary(
        total_requirements_checked=summary_data["total_requirements_checked"],
        compliant=summary_data["compliant"],
        gaps_found=summary_data["gaps_found"],
        critical_gaps=summary_data["critical_gaps"]
    )
    
    return ScanResult(
        scan_id=row["scan_id"],
        status=status,
        scanned_at=ts,
        summary=summary,
        gaps=gaps
    )

@router.get("/compliance/scans/{scan_id}/export")
async def export_compliance_scan(scan_id: str):
    rows = db_service.execute_read(
        "SELECT scan_id, status, created_at, results FROM compliance_scans WHERE scan_id = %s",
        (scan_id,)
    )
    if not rows or not rows[0]["results"]:
        raise HTTPException(status_code=404, detail="Scan results not found or scan not completed")
        
    row = rows[0]
    results = json.loads(row["results"])
    
    export_package = {
        "export_metadata": {
            "scan_id": scan_id,
            "exported_at": datetime.datetime.utcnow().isoformat(),
            "status": row["status"],
            "summary": results["summary"]
        },
        "audit_package": {
            "gaps": results["gaps"]
        }
    }
    
    return {
        "download_url": f"/api/v1/compliance/scans/{scan_id}/export",
        "summary": results["summary"],
        "package": export_package
    }
