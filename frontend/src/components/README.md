# Components Directory (`src/components`)

This directory is intended for reusable, presentational UI components used across multiple pages and views in the **Student Micro-Credential Verification Engine**.

### Recommended Structure:
- **Common / Atomic Elements**: Buttons, Badges, Modals, Spinners, Tooltips.
- **Domain-Specific Components**:
  - `CredentialCard.jsx`: Displays credential metadata (issuer, student name, issue date, status).
  - `VerificationBadge.jsx`: Indicates cryptographic/blockchain verification status (Valid, Expired, Revoked).
  - `CertificateViewer.jsx`: Renders PDF/JSON-LD micro-credentials.
  - `QrCodeScanner.jsx`: Uploads or scans credential QR codes for instant verification.
