// ==============================================================================
// Student Micro-Credential Verification Engine - Transcript Service (Step 6)
// ==============================================================================

import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/transcript';

/**
 * Returns Authorization header with JWT token if available.
 */
function getAuthHeaders(explicitToken) {
  const token = explicitToken || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetches the authenticated student's authoritative co-curricular transcript.
 * 
 * @param {string} [token] - Optional token override
 * @returns {Promise<object>} Transcript data
 */
export const getMyTranscript = async (token) => {
  const response = await axios.get(`${BASE_URL}/me`, {
    headers: getAuthHeaders(token),
  });
  return response.data;
};

/**
 * Downloads the official Co-Curricular Transcript PDF for the authenticated student.
 * 
 * @param {string} [token] - Optional token override
 * @param {string} [studentName] - Optional student name for file naming
 * @returns {Promise<boolean>} Resolves to true when download triggered
 */
export const downloadTranscriptPdf = async (token, studentName = 'Student') => {
  const response = await axios.get(`${BASE_URL}/me/pdf`, {
    headers: getAuthHeaders(token),
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;

  const safeName = studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `CoCurricular-Transcript-${safeName}.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);

  return true;
};
