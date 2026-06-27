import os
import csv
import uuid
import datetime
import fitz  # PyMuPDF
import openpyxl
from PIL import Image
import io
import pytesseract
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, Distance, VectorParams

from app.config import get_settings
from app.services.db_service import db_service
from app.services.embeddings import embed_texts
from app.services.ner import extract_entities
from app.services.graph_service import graph_service

# Initialize Qdrant Client (Cloud with Local Fallback)
settings = get_settings()
qdrant_client = None

if settings.qdrant_url and settings.qdrant_api_key:
    try:
        qdrant_client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
            timeout=10.0
        )
        # Verify connection
        qdrant_client.get_collections()
        print("[INFO] Connected to Qdrant Cloud successfully.")
    except Exception as e:
        print(f"[WARNING] Qdrant Cloud connection failed: {e}. Falling back to local in-memory Qdrant database.")
        qdrant_client = QdrantClient(location=":memory:")
else:
    print("[INFO] Qdrant Cloud config missing. Using local in-memory Qdrant database.")
    qdrant_client = QdrantClient(location=":memory:")

# Initialize Collection
def init_qdrant_collection():
    collection_name = settings.qdrant_collection_name
    try:
        existing = [c.name for c in qdrant_client.get_collections().collections]
        if collection_name not in existing:
            qdrant_client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=768, distance=Distance.COSINE)
            )
            print(f"[INFO] Created Qdrant collection: {collection_name}")
    except Exception as e:
        print(f"[ERROR] Failed to initialize Qdrant collection: {e}")

init_qdrant_collection()

def extract_ocr_from_bytes(image_bytes: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(image)
    except Exception as e:
        print(f"[WARNING] OCR failed: {e}. (This is normal if Tesseract is not installed locally).")
        return "[OCR text extraction unavailable: Tesseract engine not found on host.]"

def parse_pdf(file_path: str) -> List[Dict[str, Any]]:
    pages_content = []
    try:
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            
            # If text is empty or too short, attempt OCR
            if len(text.strip()) < 50:
                print(f"[INFO] Page {page_num + 1} text content is short ({len(text)} chars). Running OCR...")
                try:
                    pix = page.get_pixmap(dpi=150)
                    img_bytes = pix.tobytes("png")
                    ocr_text = extract_ocr_from_bytes(img_bytes)
                    if len(ocr_text.strip()) > len(text.strip()):
                        text = ocr_text
                except Exception as ocr_err:
                    print(f"[WARNING] Rendering page {page_num + 1} for OCR failed: {ocr_err}")
            
            pages_content.append({
                "page": page_num + 1,
                "text": text.strip()
            })
        doc.close()
    except Exception as e:
        print(f"[ERROR] PyMuPDF failed to parse PDF {file_path}: {e}")
        raise e
    return pages_content

def parse_image(file_path: str) -> List[Dict[str, Any]]:
    try:
        with open(file_path, "rb") as f:
            img_bytes = f.read()
        text = extract_ocr_from_bytes(img_bytes)
        return [{"page": 1, "text": text.strip()}]
    except Exception as e:
        print(f"[ERROR] Image parsing failed: {e}")
        raise e

def parse_xlsx(file_path: str) -> List[Dict[str, Any]]:
    pages_content = []
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        # Read first sheet
        ws = wb.active
        rows_text = []
        for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
            if not any(row):  # Skip empty rows
                continue
            cols_str = []
            for col_idx, val in enumerate(row, start=1):
                if val is not None:
                    cols_str.append(f"col{col_idx}={val}")
            if cols_str:
                rows_text.append(f"Row {i}: " + ", ".join(cols_str))
        
        full_text = "\n".join(rows_text)
        pages_content.append({"page": 1, "text": full_text})
        wb.close()
    except Exception as e:
        print(f"[ERROR] Excel parsing failed: {e}")
        raise e
    return pages_content

def parse_csv(file_path: str) -> List[Dict[str, Any]]:
    pages_content = []
    try:
        rows_text = []
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            for i, row in enumerate(reader, start=1):
                if not any(row):
                    continue
                cols_str = [f"col{idx}={val}" for idx, val in enumerate(row, start=1) if val.strip() != ""]
                if cols_str:
                    rows_text.append(f"Row {i}: " + ", ".join(cols_str))
                    
        full_text = "\n".join(rows_text)
        pages_content.append({"page": 1, "text": full_text})
    except Exception as e:
        print(f"[ERROR] CSV parsing failed: {e}")
        raise e
    return pages_content

def chunk_text(text: str, chunk_size_words: int = 400, overlap_words: int = 40) -> List[str]:
    words = text.split()
    if len(words) <= chunk_size_words:
        return [text]
        
    chunks = []
    i = 0
    while i < len(words):
        chunk_words = words[i:i + chunk_size_words]
        chunks.append(" ".join(chunk_words))
        i += chunk_size_words - overlap_words
    return chunks

async def process_ingestion_job(job_id: str, files_info: List[Dict[str, str]], doc_type: str, tags: List[str]):
    """Background ingestion task. Never crashes — handles individual file exceptions and marks job completed/completed_with_errors."""
    print(f"[INGESTION] Starting Job {job_id} containing {len(files_info)} files.")
    
    # Update Job Status in DB
    db_service.execute_write(
        "UPDATE jobs SET status = 'processing', progress = 10 WHERE job_id = %s",
        (job_id,)
    )
    
    documents_processed = 0
    total_entities_extracted = 0
    errors = []
    
    try:
        for idx, file_info in enumerate(files_info):
            filename = file_info["filename"]
            local_path = file_info["local_path"]
            doc_id = str(uuid.uuid4())
            
            try:
                # 1. Create Document row in DB as processing
                db_service.execute_write(
                    """
                    INSERT INTO documents (doc_id, filename, doc_type, status, page_count, tags)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (doc_id, filename, doc_type, "processing", 0, ",".join(tags))
                )
                
                # 2. Parse File
                ext = os.path.splitext(filename)[1].lower()
                pages = []
                if ext == ".pdf":
                    pages = parse_pdf(local_path)
                elif ext in (".png", ".jpg", ".jpeg"):
                    pages = parse_image(local_path)
                elif ext in (".xlsx", ".xls"):
                    pages = parse_xlsx(local_path)
                elif ext == ".csv":
                    pages = parse_csv(local_path)
                else:
                    # Treat as text
                    with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
                        text = f.read()
                    pages = [{"page": 1, "text": text}]
                    
                page_count = len(pages)
                db_service.execute_write(
                    "UPDATE documents SET page_count = %s WHERE doc_id = %s",
                    (page_count, doc_id)
                )
                
                # Add to graph
                timestamp_str = datetime.datetime.utcnow().isoformat()
                graph_service.add_document(doc_id, filename, doc_type, timestamp_str)
                
                all_extracted_entities = []
                qdrant_points = []
                
                for page in pages:
                    page_num = page["page"]
                    page_text = page["text"]
                    if not page_text.strip():
                        continue
                        
                    # 3. Entity Extraction (NER)
                    entities = extract_entities(page_text, doc_id, page_num)
                    
                    # Deduplicate entities (reuse ID if type & value match)
                    for ent in entities:
                        existing = db_service.execute_read(
                            "SELECT entity_id FROM entities WHERE type = %s AND LOWER(value) = LOWER(%s) LIMIT 1",
                            (ent["type"], ent["value"].strip())
                        )
                        if existing:
                            ent["entity_id"] = existing[0]["entity_id"]
                        else:
                            db_service.execute_write(
                                """
                                INSERT INTO entities (entity_id, doc_id, type, value, context, page, confidence)
                                VALUES (%s, %s, %s, %s, %s, %s, %s)
                                """,
                                (ent["entity_id"], doc_id, ent["type"], ent["value"].strip(), ent["context"], ent["page"], ent["confidence"])
                            )
                        all_extracted_entities.append(ent)
                        
                    # 4. Chunking & Embeddings
                    chunks = chunk_text(page_text)
                    if chunks:
                        embeddings = await embed_texts(chunks, settings.jina_api_key)
                        
                        # Prepare Qdrant Points
                        for chunk_idx, (chunk_text_data, emb) in enumerate(zip(chunks, embeddings)):
                            qdrant_points.append(
                                PointStruct(
                                    id=str(uuid.uuid4()),
                                    vector=emb,
                                    payload={
                                        "doc_id": doc_id,
                                        "filename": filename,
                                        "doc_type": doc_type,
                                        "page": page_num,
                                        "chunk_index": chunk_idx,
                                        "upload_timestamp": timestamp_str,
                                        "tags": tags,
                                        "text": chunk_text_data
                                    }
                                )
                            )
                            
                # Upload to Qdrant
                if qdrant_points:
                    qdrant_client.upsert(
                        collection_name=settings.qdrant_collection_name,
                        points=qdrant_points
                    )
                    
                # 5. Build Knowledge Graph linkages
                if all_extracted_entities:
                    graph_service.build_page_relationships(doc_id, filename, all_extracted_entities)
                    
                # Update Document row to completed
                db_service.execute_write(
                    "UPDATE documents SET status = 'completed', entity_count = %s WHERE doc_id = %s",
                    (len(all_extracted_entities), doc_id)
                )
                
                documents_processed += 1
                total_entities_extracted += len(all_extracted_entities)
                
                # Update Job progress
                pct = int(10 + (idx + 1) / len(files_info) * 85)
                db_service.execute_write(
                    """
                    UPDATE jobs 
                    SET progress = %s, documents_processed = %s, entities_extracted = %s
                    WHERE job_id = %s
                    """,
                    (pct, documents_processed, total_entities_extracted, job_id)
                )
                
            except Exception as file_err:
                print(f"[ERROR] Ingestion failed for file {filename}: {file_err}")
                errors.append(f"{filename}: {str(file_err)[:100]}")
                # Mark document as failed in DB
                db_service.execute_write(
                    "UPDATE documents SET status = 'failed' WHERE doc_id = %s",
                    (doc_id,)
                )
                continue
                
        # Finish Job
        if errors:
            error_summary = "; ".join(errors)
            db_service.execute_write(
                "UPDATE jobs SET status = 'completed_with_errors', progress = 100, error = %s WHERE job_id = %s",
                (error_summary, job_id)
            )
            print(f"[INGESTION] Completed Job {job_id} with errors: {error_summary}")
        else:
            db_service.execute_write(
                "UPDATE jobs SET status = 'completed', progress = 100 WHERE job_id = %s",
                (job_id,)
            )
            print(f"[INGESTION] Completed Job {job_id} successfully.")
            
    except Exception as job_err:
        print(f"[INGESTION] Ingestion job {job_id} encountered catastrophic failure: {job_err}")
        db_service.execute_write(
            "UPDATE jobs SET status = 'failed', error = %s WHERE job_id = %s",
            (f"Catastrophic failure: {str(job_err)[:200]}", job_id)
        )
