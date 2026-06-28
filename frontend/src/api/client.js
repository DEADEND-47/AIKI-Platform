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
  
  // Inject JWT Auth Header
  const token = localStorage.getItem('token');
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (body instanceof FormData) { 
    options.body = body; 
  }
  else if (body) { 
    options.headers['Content-Type'] = 'application/json'; 
    options.body = JSON.stringify(body); 
  }
  
  const res = await fetch(url.toString(), options);
  if (res.status === 401) {
    localStorage.removeItem('token');
    // Prevent infinite redirect loop if already on login page
    if (!window.location.pathname.endsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) { 
    const err = await res.json(); 
    throw err; 
  }
  return res.json();
}

// Auth
export const login = (body) => request('POST', '/auth/login', body);
export const register = (body) => request('POST', '/auth/register', body);
export const getMe = () => request('GET', '/auth/me');

// Documents
export const uploadDocuments = (formData) => request('POST', '/documents/upload', formData);
export const getJobStatus = (jobId) => request('GET', `/documents/status/${jobId}`);
export const listDocuments = (params) => request('GET', '/documents', null, params);
export const getDocument = (docId) => request('GET', `/documents/${docId}`);
export const getDocumentVersions = (docId) => request('GET', `/documents/${docId}/versions`);
export const compareDocumentVersions = (docId, otherDocId) => request('GET', `/documents/${docId}/compare/${otherDocId}`);

// Graph
export const listEntities = (params) => request('GET', '/graph/entities', null, params);
export const getEntityRelationships = (entityId) => request('GET', `/graph/entities/${entityId}/relationships`);
export const getFullGraph = (params) => request('GET', '/graph/full', null, params);

// Equipment
export const getEquipmentTimeline = (tag, params) => request('GET', `/equipment/${tag}/timeline`, null, params);

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
