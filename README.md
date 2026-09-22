# Student Credential Engine
### Automated Student Micro-Credential & Skill Verification Engine

An enterprise-ready micro-credentialing and skills verification platform designed for academic institutions, employers, and authorized issuers. The system extracts competencies from certificates, validates credentials against institutional taxonomies, supports SSRF-protected issuer verification, and provides public verification portals.

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Axios, Lucide React
- **Backend**: Node.js, Express.js, Multer, Tesseract.js (OCR), PDF-Lib / PDF-Parse
- **Database**: PostgreSQL (pg pool, bcrypt password hashing, pgcrypto)
- **AI & Skill Analysis**: Google Gemini API (`@google/genai`), OpenAI API (optional fallback)
- **Security**: JWT Authentication, Role-Based Access Control (Issuer & Admin), SSRF-protected issuer verification

---

## 📁 Project Structure

```
student-credential-engine/
├── backend/                  # Express REST API & Verification Engine
│   ├── config/               # Database and AI service configurations
│   ├── controllers/          # Request handlers (Upload, Processing)
│   ├── middleware/           # JWT Authentication & RBAC middleware
│   ├── routes/               # Modular Express API endpoints
│   ├── services/             # Parser, OCR, Skill Analysis & Verification
│   ├── uploads/              # Local upload directory (.gitkeep)
│   └── package.json
├── frontend/                 # React SPA (Vite + Tailwind CSS)
│   ├── public/               # Static assets & favicons
│   ├── src/
│   │   ├── components/       # Reusable UI components & ProtectedRoute
│   │   ├── context/          # AuthContext & Session management
│   │   ├── pages/            # View components (Dashboard, Verify, etc.)
│   │   └── services/         # Client-side API service modules
│   └── package.json
├── database/                 # PostgreSQL Schema & Migrations
│   ├── schema.sql            # Master database schema reference
│   └── migrations/           # Database migration files
└── README.md
```

---

## 🚀 Local Setup Instructions

### 1. Prerequisites
- **Node.js**: v18+ or v20+ recommended
- **PostgreSQL**: v14+ installed and running locally

### 2. Clone the Repository
```bash
git clone https://github.com/AIRDC-BWU/student-credential-engine.git
cd student-credential-engine
```

### 3. Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 4. Configure Environment Variables
Copy the example environment files and provide your local credentials:

**Backend:**
```bash
# In backend/
cp .env.example .env
```
Update `backend/.env` with your PostgreSQL database credentials:
```env
PORT=5000
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=student_credential_engine
DB_PORT=5432
JWT_SECRET=your_secure_jwt_secret
GEMINI_API_KEY=your_gemini_api_key   # Optional
OPENAI_API_KEY=your_openai_api_key   # Optional
```

**Frontend:**
```bash
# In frontend/
cp .env.example .env
```
Ensure `frontend/.env` points to your backend URL:
```env
VITE_API_URL=http://localhost:5000
```

### 5. Initialize the Database

#### Option A: Brand-New Database Setup
For a fresh PostgreSQL database, execute the master schema followed by the canonical skills seed:
```bash
psql -U postgres -d student_credential_engine -f database/schema.sql
psql -U postgres -d student_credential_engine -f database/seed.sql
```

#### Option B: Existing Database Synchronization
For an existing database with real data, execute the non-destructive schema migration followed by the canonical skills seed. This safely adds all required columns, constraints, and indexes without dropping tables or deleting data:
```bash
psql -U postgres -d student_credential_engine -f database/migrations/sync_current_schema.sql
psql -U postgres -d student_credential_engine -f database/seed.sql
```

### 6. Run the Application

**Start the Backend Server:**
```bash
cd backend
npm start
# Server will run on http://localhost:5000
```

**Start the Frontend Client:**
```bash
cd frontend
npm run dev
# Application will run on http://localhost:5173
```

---

## 🔒 Roles & Access Control

- **Issuer**: Standard user role for institutions and authorized bodies to upload credentials, view transcripts, and inspect portfolio milestones.
- **Admin**: System administrator role for auditing submissions, approving/rejecting credentials, and managing platform compliance.

---

## 🧪 Automated Testing & Final 20-Certificate Acceptance Suite

The engine includes exhaustive test suites covering all system subsystems and an end-to-end 20-certificate acceptance test:

### Running the Final 20-Certificate Acceptance Test (Step 7)
```bash
cd backend
npm run test:acceptance
```
This suite ingests 20 sample third-party certificates across 5 categories:
- **8 Valid Credentials**: NPTEL, Coursera, edX, Credly, and Accredible certificates verified against authoritative sources.
- **4 Forged / Adversarial Credentials**: Suffix spoofing/typosquatting, altered credential IDs, revoked certificates, and SSRF metadata attacks (confirming 0 forged credentials are automatically verified).
- **4 Manual Review Credentials**: Unsupported issuers, missing verification URLs, network timeouts, and HTTP 200 responses without credential evidence.
- **2 OCR / Scanned Credentials**: Image-only PDF and PNG certificates processed via Tesseract OCR.
- **2 Edge / Malformed Credentials**: Corrupt PDF stream and incomplete metadata documents handled gracefully.

**Key Measured Metrics:**
- **Overall Case Pass Rate**: 20/20 (100.0%)
- **Forged Credentials Verified**: 0 (Critical security invariant verified)
- **Skill Precision**: 0.9474
- **Skill Recall**: 1.0000 (100% recall of expected canonical skills)
- **Skill F1 Score**: 0.9730
- **Open Badges 3.0 Restriction**: 100% enforced (Issued strictly for `VERIFIED`)
- **Transcript Inclusion**: 100% enforced (Included strictly for `VERIFIED`)
- **Database Residual Data**: 0 leaked rows (Exact baseline restored)

Results are automatically saved to:
- Machine-readable: `backend/tests/results/acceptance-20-certificates.json`
- Human-readable: `backend/tests/results/acceptance-20-certificates.md`

### Running Regression Test Suites
```bash
cd backend

# Step 1: Database schema consistency validation
npm run test:database

# Step 2: Automatic certificate parsing & OCR
npm run test:parser

# User-scoped duplicate prevention test
node tests/testDuplicatePrevention.js

# Step 3: Certificate authenticity verification & SSRF defense
node tests/issuerVerification.test.js

# Step 4: Activity logs & skill taxonomy mapping
node tests/activityLogs.test.js

# Step 5: Open Badges 3.0 & cryptographic verifiable credentials
node tests/openBadges.test.js

# Step 6: Comprehensive co-curricular transcript builder
node tests/transcript.test.js
```
