# AIKI — Asset & Operations Brain

AIKI is a production-ready, full-stack industrial knowledge intelligence platform. It ingests complex industrial documents (maintenance records, safety procedures, and inspection reports), extracts key entities (equipment tags, process parameters, failure modes), builds a knowledge graph, performs semantic search using RAG with inline citations, and automatically scans operations against industrial regulations to identify compliance gaps.

---

## Key Features

*   **Document Hub & Ingestion**: Drag-and-drop file uploader supporting PDFs, CSVs, and Excel files. Features background job queues and NLP-based entity extraction.
*   **Knowledge Copilot (RAG)**: Ask plain-language questions and receive answers cited down to the source document and page number. Uses Jina AI Embeddings, Qdrant Cloud vector search, Jina Reranker API, and Groq (Llama-3 70B) for fast inference.
*   **Compliance Dashboard**: Scans documents against regulatory standards (e.g., OISD-118, Factory Act) and flags critical/moderate compliance gaps, detailing overdue durations and specific remediation recommendations.
*   **Interactive Knowledge Graph**: Maps relationships between assets, personnel, maintenance records, and regulatory clauses using Neo4j AuraDB.

---

## Tech Stack

### Backend (FastAPI)
*   **Core API**: FastAPI, Uvicorn
*   **Vector Database**: Qdrant Cloud (Vector search)
*   **Graph Database**: Neo4j AuraDB (Knowledge graph)
*   **Relational Database**: PostgreSQL (Metadata & Ingestion Jobs)
*   **NLP/NER**: spaCy (`en_core_web_sm`)
*   **LLM & Reranker**: Groq API (Llama-3), Jina Embeddings & Reranker APIs

### Frontend (React)
*   **Framework**: React 18, Vite
*   **Routing**: React Router DOM v6
*   **State Management**: React Query (TanStack Query)
*   **Data Visualization**: Recharts
*   **Styling**: CSS, Tailwind CSS

---

## Project Structure

```
industrial-knowledge-ai/
├── backend/                  # FastAPI Backend
│   ├── app/
│   │   ├── models/           # Pydantic schemas
│   │   ├── routers/          # API endpoint routes
│   │   ├── services/         # Core logic (RAG, Ingestion, Compliance)
│   │   └── main.py           # App entrypoint
│   ├── scripts/              # Pre-ingest & RAM check utilities
│   ├── requirements.txt      # Python dependencies
│   └── test_backend.py       # Integration test suite
├── frontend/                 # Vite React Frontend
│   ├── src/
│   │   ├── api/              # HTTP API client
│   │   ├── components/       # Layout, badges, skeleton loaders
│   │   └── pages/            # Documents, Copilot, Compliance, Graph views
│   ├── package.json          # Node dependencies
│   └── vercel.json           # SPA routing overrides
├── sample_docs/              # 10 preloaded industrial documents
├── render.yaml               # Render infrastructure blueprint
└── vercel.json               # Vercel project configurations
```

---

## Setup & Running Locally

### Prerequisites
*   Python 3.11.x
*   Node.js (v18+)

### 1. Run Backend Server
Configure your credentials in `backend/.env` (relying on local SQLite/In-memory fallbacks if blank):
```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app.main:app --reload --port 8000
```

### 2. Pre-Ingest Sample Documents
Ensure your backend server is running, then load the 10 default plant files:
```bash
cd backend
python scripts/pre_ingest.py
```

### 3. Run Frontend Server
Launch the Vite React development server:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Production Deployment

### Backend (Render)
1. Deploy the `backend/` directory as a Web Service.
2. Build Command: `pip install -r requirements.txt && python -m spacy download en_core_web_sm`
3. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add a Render PostgreSQL instance and configure `DATABASE_URL`, `GROQ_API_KEY`, `JINA_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` in the environment variables.

### Frontend (Vercel)
1. Import the repository and set the root directory to `frontend/`.
2. Configure Environment Variable: `VITE_API_BASE_URL` pointing to your Render backend API.
