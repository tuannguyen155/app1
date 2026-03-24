import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper function to get blob URL for download
export const getDownloadUrl = (path) => {
  const token = localStorage.getItem('token');
  return `${API_URL}${path}?token=${token}`;
};

// Auth API
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

// Users API
export const usersApi = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
};

// Documents API
export const documentsApi = {
  list: () => api.get('/documents'),
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  get: (id) => api.get(`/documents/${id}`),
  download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/documents/${id}`),
};

// Workflows API
export const workflowsApi = {
  list: (status) => api.get('/workflows', { params: { status_filter: status } }),
  get: (id) => api.get(`/workflows/${id}`),
  create: (data) => api.post('/workflows', data),
  update: (id, data) => api.put(`/workflows/${id}`, data),
  delete: (id) => api.delete(`/workflows/${id}`),
  
  // Documents
  addDocument: (workflowId, file, isMain = false, description = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_main', isMain);
    if (description) formData.append('description', description);
    return api.post(`/workflows/${workflowId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  listDocuments: (workflowId, pdfOnly = true) => 
    api.get(`/workflows/${workflowId}/documents`, { params: { pdf_only: pdfOnly } }),
  
  // Signers
  addSigner: (workflowId, userId, stepOrder) => 
    api.post(`/workflows/${workflowId}/signers`, { user_id: userId, step_order: stepOrder }),
  listSigners: (workflowId) => api.get(`/workflows/${workflowId}/signers`),
  removeSigner: (workflowId, signerId) => 
    api.delete(`/workflows/${workflowId}/signers/${signerId}`),
  
  // Signature Positions
  setSignerSignaturePositions: (workflowId, signerId, positions) => 
    api.post(`/workflows/${workflowId}/signers/${signerId}/signature-positions`, positions),
  getSignaturePositions: (workflowId, signerId) => 
    api.get(`/workflows/${workflowId}/signature-positions`, { 
      params: { signer_id: signerId } 
    }),
  
  // Actions
  send: (workflowId) => api.post(`/workflows/${workflowId}/send`),
  recall: (workflowId) => api.post(`/workflows/${workflowId}/recall`),
  sign: (workflowId) => api.post(`/workflows/${workflowId}/sign`),
  reject: (workflowId, reason) => api.post(`/workflows/${workflowId}/reject`, { reason }),
  
  // Export
  export: (workflowId, description) => 
    api.post(`/workflows/${workflowId}/export`, { description }),
  listExports: (workflowId) => api.get(`/workflows/${workflowId}/exports`),
  downloadExport: (workflowId, exportId) => 
    api.get(`/workflows/${workflowId}/export/${exportId}/download`, { responseType: 'blob' }),
};

// Signatures API
export const signaturesApi = {
  list: () => api.get('/signatures'),
  upload: (file, isDefault = false) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_default', isDefault);
    return api.post('/signatures/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id) => api.delete(`/signatures/${id}`),
  setDefault: (id) => api.put(`/signatures/${id}/set-default`),
  getImage: (id) => `${API_URL}/api/signatures/${id}/image`,
};
