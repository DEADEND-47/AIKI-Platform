from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class DocType(str, Enum):
    MAINTENANCE_RECORD = "maintenance_record"
    SAFETY_PROCEDURE = "safety_procedure"
    INSPECTION_REPORT = "inspection_report"
    ENGINEERING_DRAWING = "engineering_drawing"
    OPERATING_INSTRUCTION = "operating_instruction"
    REGULATORY_DOCUMENT = "regulatory_document"
    OTHER = "other"

class EntityType(str, Enum):
    EQUIPMENT_TAG = "equipment_tag"
    PROCESS_PARAMETER = "process_parameter"
    REGULATORY_REF = "regulatory_ref"
    PERSONNEL = "personnel"
    DATE = "date"
    FAILURE_MODE = "failure_mode"
    LOCATION = "location"

class Entity(BaseModel):
    entity_id: str
    type: EntityType
    value: str
    context: str
    page: int
    confidence: float

class DocumentMetadata(BaseModel):
    doc_id: str
    filename: str
    doc_type: DocType
    upload_timestamp: datetime
    status: str   # queued | processing | completed | failed
    entity_count: int
    tags: List[str] = []
    version: Optional[int] = 1
    parent_doc_id: Optional[str] = None
    is_latest: Optional[bool] = True
    plant_id: Optional[str] = None

class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: int
    documents_processed: int
    entities_extracted: int
    error: Optional[str] = None

class CopilotSource(BaseModel):
    doc_id: str
    filename: str
    doc_type: str
    page: int
    excerpt: str
    relevance_score: float

class CopilotResponse(BaseModel):
    session_id: str
    query: str
    answer: str
    confidence_score: float
    confidence_label: Optional[str] = None
    sources: List[CopilotSource]
    follow_up_suggestions: List[str]

class ComplianceGap(BaseModel):
    gap_id: str
    regulation: str
    clause: str
    requirement: str
    severity: str        # critical | high | moderate
    status: str          # missing_evidence | outdated_document | partial | compliant
    finding: str
    recommended_action: str
    evidence_documents: List[dict] = []

class ScanSummary(BaseModel):
    total_requirements_checked: int
    compliant: int
    gaps_found: int
    critical_gaps: int

class ScanResult(BaseModel):
    scan_id: str
    status: str
    scanned_at: Optional[datetime]
    summary: Optional[ScanSummary]
    gaps: List[ComplianceGap] = []

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict = {}

class ErrorResponse(BaseModel):
    error: ErrorDetail
