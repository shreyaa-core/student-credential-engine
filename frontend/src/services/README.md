# Services Directory (`src/services`)

This directory encapsulates all external integrations, network communications, and backend API interactions.

### Recommended Services:
- `apiClient.js`: Centralized fetch/axios configuration handling base URLs, headers, and interceptors.
- `verificationService.js`: Business logic for communicating with the backend verification endpoint, IPFS, or smart contracts to check credential signatures and revocation status.
- `credentialService.js`: Endpoints for fetching student credentials, downloading certificates, or creating credential issuance requests.
- `authService.js`: Authentication management (JWT tokens, session handling) for student and issuer logins.
