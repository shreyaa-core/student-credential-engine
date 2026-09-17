// ==============================================================================
// Verification Service Test Script
// ==============================================================================

const verificationService = require('./services/verificationService');

// Extract verification function (supports both direct function or object export)
const verifyCertificate = verificationService.verifyCertificate || verificationService;

// Test certificate data
const testCertificate = {
  studentName: "Rahul",
  courseName: "Machine Learning",
  issuer: "NPTEL",
  certificateId: "12345",
  issueDate: "2026-09-10",
  verificationUrl: "https://nptel.ac.in"
};

console.log("Testing verificationService with certificate:");
console.log(testCertificate);
console.log("\n--------------------------------------------\n");

// Execute verification
const result = verifyCertificate(testCertificate);

// Print result to console
console.log("Verification Result:");
console.log(JSON.stringify(result, null, 2));

console.log("\nSummary:");
console.log(`- Final Score: ${result.score}/100`);
console.log(`- Verification Status: ${result.status}`);
