import axios from 'axios';

const API_URL = 'http://localhost:5000/api/certificates/upload';

/**
 * Uploads a certificate file and metadata to the Express backend.
 * 
 * @param {File} file - Selected certificate file (PDF, PNG, or JPG)
 * @param {string} certificateName - Title or name of the certificate
 * @param {string} issuer - Issuing organization or institution
 * @returns {Promise<object>} - Backend response data ({ success: true, message: "Certificate saved" })
 */
export const uploadCertificate = async (file, certificateName, issuer, studentId = null) => {
  // Create multipart/form-data payload
  const formData = new FormData();
  formData.append('certificate', file);
  formData.append('certificate_name', certificateName);
  formData.append('issuer', issuer);
  if (studentId) {
    formData.append('student_id', studentId);
  }

  // Send POST request with multipart headers
  const response = await axios.post(API_URL, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export default {
  uploadCertificate,
};
