import { getEdgeFunctionUrl, getAuthHeaders } from './supabase';

async function callEdgeFunction(name: string, options: RequestInit) {
  const url = getEdgeFunctionUrl(name);
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Tender Management
export const tenderApi = {
  list: () =>
    callEdgeFunction('tender-management', { method: 'GET' }),

  get: (id: string) =>
    callEdgeFunction(`tender-management/${id}`, { method: 'GET' }),

  create: (data: { title: string; reference_no: string; uploaded_by?: string }) =>
    callEdgeFunction('tender-management', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Record<string, unknown>) =>
    callEdgeFunction(`tender-management/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updateCriterion: (tenderId: string, criterionId: string, data: Record<string, unknown>) =>
    callEdgeFunction(`tender-management/${tenderId}/criteria/${criterionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updateEvaluation: (tenderId: string, evalId: string, data: Record<string, unknown>) =>
    callEdgeFunction(`tender-management/${tenderId}/evaluations/${evalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  addBidder: (tenderId: string, data: { name: string; uploaded_by?: string }) =>
    callEdgeFunction(`tender-management/${tenderId}/bidders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getActivity: () =>
    callEdgeFunction('tender-management/activity', { method: 'GET' }),
};

// Document OCR
export const ocrApi = {
  process: (data: { file_url?: string; file_base64?: string; language?: string; file_id?: string }) =>
    callEdgeFunction('document-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// Criteria Extraction
export const criteriaApi = {
  extract: (data: { tender_id: string; ocr_text?: string }) =>
    callEdgeFunction('criteria-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// Evaluation
export const evaluationApi = {
  evaluate: (data: { tender_id: string }) =>
    callEdgeFunction('evaluate-bidders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// File Upload
export const fileApi = {
  upload: async (file: File, bidderId: string, tenderId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bidder_id', bidderId);
    formData.append('tender_id', tenderId);

    const url = getEdgeFunctionUrl('file-upload');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeaders().Authorization,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  uploadTenderDoc: async (file: File, tenderId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tender_id', tenderId);

    const url = getEdgeFunctionUrl('file-upload');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeaders().Authorization,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  getSignedUrl: (path: string) =>
    callEdgeFunction('file-upload/download?path=' + encodeURIComponent(path), { method: 'GET' }),

  delete: (path: string) =>
    callEdgeFunction('file-upload?path=' + encodeURIComponent(path), { method: 'DELETE' }),
};

// Seed Data
export const seedApi = {
  seed: () =>
    callEdgeFunction('seed-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }),
};
