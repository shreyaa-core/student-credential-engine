const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { generateToken } = require('../middleware/authMiddleware');

const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = '2d56ab4e-ce06-47b1-afc4-ec0f341a4b90';
const AUTH_TOKEN = generateToken({ id: TEST_USER_ID, email: 'poojadas@gmail.com', role: 'Student' });

async function testOne(filename, mime) {
  const filePath = path.join(__dirname, '../../sample-certificates', filename);
  console.log('\n===============================================================');
  console.log(`TESTING POST /api/certificates/parse for: ${filename}`);
  console.log('===============================================================');

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename,
    contentType: mime,
  });

  const response = await axios.post(`${BASE_URL}/api/certificates/parse`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  });

  console.log('HTTP Status:', response.status);
  console.log('API Response Data:');
  console.log(JSON.stringify(response.data, null, 2));
}

async function run() {
  await testOne('corsera demo.png', 'image/png');
  await testOne('coursera demo 2.jpg', 'image/jpeg');
}

run().catch((err) => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
