import re
import uuid
import spacy
import spacy.cli
from typing import List, Dict, Any
from app.models.schemas import EntityType

# Lazy loaded spacy model
nlp = None
def get_spacy_nlp():
    global nlp
    if nlp is None:
        try:
            nlp = spacy.load("en_core_web_sm")
        except Exception:
            print("Downloading spaCy model en_core_web_sm...")
            try:
                spacy.cli.download("en_core_web_sm")
                nlp = spacy.load("en_core_web_sm")
            except Exception as e:
                print(f"Failed to download spaCy model: {e}")
                # Return a basic dummy object that splits text into sentences
                class DummySentence:
                    def __init__(self, text):
                        self.text = text
                class DummyDoc:
                    def __init__(self, text):
                        self.text = text
                        # Simple sentence splitter
                        self.sents = [DummySentence(s.strip() + ".") for s in text.split(".") if s.strip()]
                        self.ents = []
                class DummyNlp:
                    def __call__(self, text):
                        return DummyDoc(text)
                nlp = DummyNlp()
    return nlp

PATTERNS = {
    "equipment_tag": [
        r'\b[A-Z]{1,4}-\d{2,4}[A-Z]?\b',          # P-101A, V-204, PRV-201
        r'\b[A-Z]{2,4}\d{3,4}[A-Z]?\b',             # HX301, FIC2012
    ],
    "process_parameter": [
        r'\b\d+(?:\.\d+)?\s*(?:bar|psi|kPa|MPa)\b', # 12 bar, 150 psi
        r'\b\d+(?:\.\d+)?\s*°?(?:C|F|K)\b',          # 350°C, 77F
        r'\b\d+(?:\.\d+)?\s*(?:rpm|l/min|m3/h|kg/h)\b',
        r'\b\d+(?:\.\d+)?\s*mm\b',                   # 0.8mm
    ],
    "regulatory_ref": [
        r'\bOISD[-–]\d+\b',                          # OISD-118
        r'\bPESO\b',
        r'\bISO[-–]\d+\b',                            # ISO-9001
        r'\bFactory\s+Act\b',
        r'\bClause\s+\d+(?:\.\d+)*\b',               # Clause 4.3
        r'\bSection\s+\d+[A-Z]?\b',                  # Section 41B
    ],
    "failure_mode": [
        r'\b(?:bearing\s+wear|seal\s+leak(?:age)?|vibration|cavitation|'
        r'corrosion|erosion|fouling|blockage|overheat(?:ing)?)\b',
    ]
}

PLANT_KEYWORDS = ["plant", "refinery", "unit", "station", "building", "yard", "area", "facility", "tank", "pump", "boiler"]

def extract_entities(text: str, doc_id: str, page: int) -> List[Dict[str, Any]]:
    entities = []
    nlp_model = get_spacy_nlp()
    doc = nlp_model(text)
    
    # Sentence database for context lookup
    sentences = [sent.text.strip() for sent in doc.sents]
    
    def find_context_sentence(val: str) -> str:
        for sent in sentences:
            if val in sent:
                return sent
        # Fallback to a subsegment of text
        idx = text.find(val)
        if idx != -1:
            start = max(0, idx - 60)
            end = min(len(text), idx + len(val) + 60)
            return text[start:end].replace('\n', ' ').strip()
        return val

    # Pass 1: spaCy Entities
    # Extract: PERSON -> personnel, ORG -> location (if plant related), DATE -> date, GPE/LOC -> location
    if hasattr(doc, "ents"):
        for ent in doc.ents:
            val = ent.text.strip()
            if not val:
                continue
            
            ent_type = None
            confidence = 0.85
            
            if ent.label_ == "PERSON":
                ent_type = EntityType.PERSONNEL
                confidence = 0.90
            elif ent.label_ == "DATE":
                ent_type = EntityType.DATE
                confidence = 0.88
            elif ent.label_ in ("GPE", "LOC"):
                ent_type = EntityType.LOCATION
                confidence = 0.85
            elif ent.label_ == "ORG":
                # Check if it relates to a plant/location
                val_lower = val.lower()
                if any(keyword in val_lower for keyword in PLANT_KEYWORDS):
                    ent_type = EntityType.LOCATION
                    confidence = 0.85
            
            if ent_type:
                entities.append({
                    "entity_id": str(uuid.uuid4()),
                    "doc_id": doc_id,
                    "type": ent_type,
                    "value": val,
                    "context": find_context_sentence(val),
                    "page": page,
                    "confidence": confidence
                })
                
    # Pass 2: Custom Regex
    for label, regex_list in PATTERNS.items():
        for regex_pattern in regex_list:
            matches = re.finditer(regex_pattern, text, re.IGNORECASE)
            for m in matches:
                val = m.group(0).strip()
                # Check if it's already extracted under the same type
                if any(e["type"] == label and e["value"].lower() == val.lower() for e in entities):
                    continue
                
                # Determine EntityType enum value
                ent_type = EntityType(label)
                
                # Check if matches the regex exactly
                confidence = 0.95
                
                entities.append({
                    "entity_id": str(uuid.uuid4()),
                    "doc_id": doc_id,
                    "type": ent_type,
                    "value": val,
                    "context": find_context_sentence(val),
                    "page": page,
                    "confidence": confidence
                })
                
    return entities
