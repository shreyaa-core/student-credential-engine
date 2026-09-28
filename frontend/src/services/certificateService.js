import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/certificates';

/**
 * Parses a certificate file (PDF, PNG, JPG, JPEG) using the backend parsing engine.
 * Standalone parse endpoint: does not modify or store records in the database.
 * 
 * @param {File} file - Selected certificate file
 * @returns {Promise<object>} - { success: true, data: { certificate_name, issuer, certificate_id, issue_date, verification_url, file_type, raw_text } }
 */
export const parseCertificate = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(`${BASE_URL}/parse`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

/**
 * Uploads a certificate file and metadata to the Express backend.
 * 
 * Supports both signatures:
 * 1. uploadCertificate(file, certificateDetailsObject)
 * 2. uploadCertificate(file, certificateName, issuer, studentId)
 * 
 * @param {File} file - Selected certificate file (PDF, PNG, or JPG)
 * @param {object|string} certificateData - Metadata object or certificateName string
 * @param {string} [issuer] - Issuing organization (if positional)
 * @param {string} [studentId] - Student UUID (if positional)
 * @returns {Promise<object>} - Backend response data
 */
export const uploadCertificate = async (file, certificateData, issuer = null, studentId = null) => {
  const formData = new FormData();
  formData.append('certificate', file);

  if (certificateData && typeof certificateData === 'object') {
    const certName = certificateData.certificate_name || certificateData.certificateName || '';
    const iss = certificateData.issuer || '';
    const certId = certificateData.certificate_id || certificateData.certificateId || '';
    const date = certificateData.issue_date || certificateData.issueDate || '';
    const url = certificateData.verification_url || certificateData.verificationUrl || '';
    const purp = certificateData.purpose || '';
    const sid = certificateData.student_id || studentId || '';

    if (certName) formData.append('certificate_name', certName);
    if (iss) formData.append('issuer', iss);
    if (certId) formData.append('certificate_id', certId);
    if (date) formData.append('issue_date', date);
    if (url) formData.append('verification_url', url);
    if (purp) formData.append('purpose', purp);
    if (sid) formData.append('student_id', sid);
  } else {
    // Positional signature fallback
    if (certificateData) formData.append('certificate_name', certificateData);
    if (issuer) formData.append('issuer', issuer);
    if (studentId) formData.append('student_id', studentId);
  }

  const response = await axios.post(`${BASE_URL}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export default {
  parseCertificate,
  uploadCertificate,
};
