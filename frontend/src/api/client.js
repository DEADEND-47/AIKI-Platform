const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

async function request(method, path, body, params) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v);
      }
    });
  }
  const options = { method, headers: {} };
  if (body instanceof FormData) { 
    options.body = body; 
  }
  else if (body) { 
    options.headers['Content-Type'] = 'application/json'; 
    options.body = JSON.stringify(body); 
  }
  
  const res = await fetch(url.toString(), options);
  if (!res.ok) { 
    const err = await res.json(); 
    throw err; 
  }
  return res.json();
}

// Documents
export const uploadDocuments = (formData) => request('POST', '/documents/upload', formData);
export const getJobStatus = (jobId) => request('GET', `/documents/status/${jobId}`);
export const listDocuments = (params) => request('GET', '/documents', null, params);
export const getDocument = (docId) => request('GET', `/documents/${docId}`);

// Graph
export const listEntities = (params) => request('GET', '/graph/entities', null, params);
export const getEntityRelationships = (entityId) => request('GET', `/graph/entities/${entityId}/relationships`);

// Copilot
// We export both Cyrillic and Latin versions to avoid import typos failing the build
export const queryСopilot = (body) => request('POST', '/copilot/query', body);
export const queryCopilot = (body) => request('POST', '/copilot/query', body);
export const getSessionHistory = (sessionId) => request('GET', `/copilot/sessions/${sessionId}/history`);

// Compliance
export const startScan = (body) => request('POST', '/compliance/scan', body);
export const getScanResults = (scanId) => request('GET', `/compliance/scans/${scanId}`);
export const exportScan = (scanId) => request('GET', `/compliance/scans/${scanId}/export`);

// Health
export const healthCheck = () => request('GET', '/health');
