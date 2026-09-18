// ==============================================================================
// Badge Service Test Script
// ==============================================================================

const badgeService = require('./services/badgeService');

// Extract generateBadge function
const generateBadge = badgeService.generateBadge || badgeService;

// Test data
const sampleCertificateData = {
  studentName: "Rahul Das",
  courseName: "Machine Learning",
  issuer: "NPTEL",
  skills: [
    "Python",
    "Machine Learning"
  ]
};

console.log("Generating badge for certificate data:");
console.log(sampleCertificateData);
console.log("\n--------------------------------------------\n");

// Generate digital badge
const generatedBadge = generateBadge(sampleCertificateData);

// Print generated badge to console
console.log("Generated Badge:");
console.log(JSON.stringify(generatedBadge, null, 2));
