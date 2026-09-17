import axios from 'axios';

/**
 * Axios instance configured with backend base URL
 */
const API = axios.create({
  baseURL: 'http://localhost:5000',
});

/**
 * Test API call to verify connection with Express backend
 * Calls GET /api/test
 */
export const getTestMessage = async () => {
  const response = await API.get('/api/test');
  return response.data;
};

export default API;
