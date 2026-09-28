const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { generateToken } = require('../middleware/authMiddleware');

const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = '2d56ab4e-ce06-47b1-afc4-ec0f341a4b90';
const AUTH_TOKEN = generateToken({ id: TEST_USER_ID, email: 'poojadas@gmail.com', role: 'Student' });

async function testEndpoint() {
  const filePath = path.join(__dirname, '../../sample-certificates/coursera demo 2.jpg');
  console.log('Sending file to /api/certificates/parse:', filePath);

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: 'coursera demo 2.jpg',
    contentType: 'image/jpeg',
  });

  const response = await axios.post(`${BASE_URL}/api/certificates/parse`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  });

  console.log('Response Status:', response.status);
  console.log('Response Data:', JSON.stringify(response.data, null, 2));
}

testEndpoint().catch((err) => {
  console.error('Test error:', err.response?.data || err.message);
  process.exit(1);
});
