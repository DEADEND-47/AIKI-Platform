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

from fastapi.responses import StreamingResponse
import io
from fpdf import FPDF

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
    summary = results.get("summary", {})
    gaps = results.get("gaps", [])
    
    # Create PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "AIKI Audit & Compliance Report", ln=True, align="C")
    pdf.ln(5)
    
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Scan ID: {scan_id}", ln=True)
    pdf.cell(0, 6, f"Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True)
    pdf.ln(5)
    
    # Summary Table
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Scan Summary:", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Total Requirements Checked: {summary.get('total_requirements_checked', 0)}", ln=True)
    pdf.cell(0, 6, f"Compliant: {summary.get('compliant', 0)}", ln=True)
    pdf.cell(0, 6, f"Gaps Found: {summary.get('gaps_found', 0)} (Critical: {summary.get('critical_gaps', 0)})", ln=True)
    pdf.ln(8)
    
    # Gaps Details
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Detailed Findings & Gaps:", ln=True)
    pdf.ln(2)
    
    for idx, gap in enumerate(gaps, 1):
        pdf.set_font("Helvetica", "B", 10)
        req_name = gap.get("regulation", "Regulation")
        clause = gap.get("clause", "Clause")
        severity = gap.get("severity", "moderate").upper()
        
        pdf.cell(0, 6, f"{idx}. {req_name} - Clause {clause} [{severity}]", ln=True)
        
        pdf.set_font("Helvetica", "I", 9)
        pdf.multi_cell(0, 5, f"Finding: {gap.get('finding', '')}")
        
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, f"Recommended Action: {gap.get('recommended_action', '')}")
        pdf.ln(4)
        
    pdf_bytes = pdf.output(dest='S')
    
    # Stream the PDF response
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=compliance-report-{scan_id[:8]}.pdf"}
    )
