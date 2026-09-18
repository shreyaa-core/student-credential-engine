// ==============================================================================
// Temporary Test Script: Verify Environment Variable Loading (JWT_SECRET)
// ==============================================================================

const path = require('path');
const dotenv = require('dotenv');

// 1. Load environment variables directly from backend/.env
const envPath = path.resolve(__dirname, '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Failed to load .env file from:', envPath);
  console.error(result.error);
  process.exit(1);
}

// 2. Read JWT_SECRET from process.env
const jwtSecret = process.env.JWT_SECRET;

// 3. Print JWT_SECRET value and status in the console
console.log('--------------------------------------------------');
console.log('✅ Environment file loaded from:', envPath);
if (jwtSecret) {
  console.log('✅ JWT_SECRET found:');
  console.log('JWT_SECRET =', jwtSecret);
} else {
  console.warn('⚠️  JWT_SECRET is not defined in backend/.env');
}
console.log('--------------------------------------------------');
