import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/admin/certificates';

/**
 * Fetches all uploaded certificates for administrative review.
 * 
 * API: GET http://localhost:5000/api/admin/certificates
 * 
 * @returns {Promise<Array>} - List of certificates from the backend
 */
export const getCertificates = async () => {
  const response = await axios.get(BASE_URL);
  return response.data;
};

/**
 * Updates the verification status of a certificate.
 * 
 * API: PUT http://localhost:5000/api/admin/certificates/:id/status
 * 
 * @param {string} id - Certificate ID
 * @param {string} status - New status (e.g. "APPROVED", "REJECTED")
 * @param {string} [notes] - Optional administrative notes
 * @returns {Promise<object>} - Backend response data
 */
export const updateCertificateStatus = async (id, status, notes = '') => {
  const response = await axios.put(`${BASE_URL}/${id}/status`, {
    status,
    admin_notes: notes,
    notes,
  });
  return response.data;
};

export default {
  getCertificates,
  updateCertificateStatus,
};
