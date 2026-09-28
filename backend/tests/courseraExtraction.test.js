/**
 * ============================================================================
 * COURSERA VERIFICATION EXTRACTION TEST SUITE
 * File: backend/tests/courseraExtraction.test.js
 * ============================================================================
 *
 * Tests the deep extraction capabilities of Coursera Verification Adapter:
 * 1.  Extraction from JSON-LD (<script type="application/ld+json">)
 * 2.  Extraction from Next.js hydration payload (__NEXT_DATA__)
 * 3.  Extraction from Apollo GraphQL client state (window.__APOLLO_STATE__)
 * 4.  Extraction from Redux / Flux window.App stores
 * 5.  Extraction from Open Graph and Twitter meta tags
 * 6.  Extraction from HTML DOM accomplishment certificate text
 * 7.  Exact credential ID matching enforcement (exact match required)
 * 8.  ID mismatch detection (mismatched ID cannot verify)
 * 9.  Explicit negative indicator handling ("record not found" -> SUSPICIOUS)
 * 10. Generic unrendered SPA fallback handling -> MANUAL_REVIEW
 * 11. Anti-bot / CAPTCHA / Login challenge handling -> MANUAL_REVIEW
 * 12. HTTP 200 alone without evidence does NOT produce VERIFIED
 * ============================================================================
 */

const assert = require('assert');
const {
  extractCourseraVerificationData,
  TRUSTED_ISSUER_REGISTRY,
  findIssuerInRegistry,
  decodeHtmlEntities,
} = require('../services/issuerVerificationService');

const courseraIssuer = findIssuerInRegistry('Coursera');
const courseraAdapter = courseraIssuer.adapter;

async function runTests() {
  console.log('===============================================================');
  console.log('RUNNING COURSERA VERIFICATION EXTRACTION TESTS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function test(description, fn) {
    try {
      fn();
      console.log(`[PASS] ${description}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${description}`);
      console.error('       Error:', err.message);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: JSON-LD Structured Data Extraction
  // --------------------------------------------------------------------------
  test('Extracts course, learner, ID, and completion from JSON-LD structured data', () => {
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "EducationalOccupationalCredential",
          "name": "Machine Learning Specialization",
          "identifier": "COURSERA-ML-987654",
          "recipient": {
            "@type": "Person",
            "name": "Alex Morgan"
          },
          "validFrom": "2024-11-15",
          "recognizedBy": {
            "@type": "Organization",
            "name": "Coursera"
          }
        }
        </script>
      </head>
      <body><div>Accomplishment Certificate</div></body>
    </html>`;

    const extracted = extractCourseraVerificationData(html, 'https://www.coursera.org/verify/COURSERA-ML-987654');
    assert.strictEqual(extracted.courseTitle, 'Machine Learning Specialization');
    assert.strictEqual(extracted.learnerName, 'Alex Morgan');
    assert.strictEqual(extracted.credentialId, 'COURSERA-ML-987654');
    assert.strictEqual(extracted.completionConfirmed, true);
    assert.strictEqual(extracted.source, 'JSON_LD');

    const result = courseraAdapter({
      html,
      url: 'https://www.coursera.org/verify/COURSERA-ML-987654',
      certificateId: 'COURSERA-ML-987654',
      certificateName: 'Machine Learning Specialization',
      studentName: 'Alex Morgan',
      httpStatus: 200,
    });
    assert.strictEqual(result.status, 'VERIFIED');
    assert.strictEqual(result.evidence.certificateIdMatched, true);
    assert.strictEqual(result.evidence.certificateNameMatched, true);
    assert.strictEqual(result.evidence.holderNameMatched, true);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Next.js __NEXT_DATA__ Hydration Extraction
  // --------------------------------------------------------------------------
  test('Extracts course, learner, and verification code from Next.js __NEXT_DATA__', () => {
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "accomplishment": {
                "id": "COURSERA-DL-543210",
                "courseName": "Deep Learning and Neural Networks",
                "learnerName": "Alex Morgan",
                "isCompleted": true,
                "completedAt": "2024-12-01"
              }
            }
          }
        }
        </script>
      </head>
      <body><div>Coursera Certificate</div></body>
    </html>`;

    const extracted = extractCourseraVerificationData(html, 'https://www.coursera.org/account/accomplishments/verify/COURSERA-DL-543210');
    assert.strictEqual(extracted.courseTitle, 'Deep Learning and Neural Networks');
    assert.strictEqual(extracted.learnerName, 'Alex Morgan');
    assert.strictEqual(extracted.credentialId, 'COURSERA-DL-543210');
    assert.strictEqual(extracted.completionConfirmed, true);

    const result = courseraAdapter({
      html,
      url: 'https://www.coursera.org/account/accomplishments/verify/COURSERA-DL-543210',
      certificateId: 'COURSERA-DL-543210',
      certificateName: 'Deep Learning and Neural Networks',
      studentName: 'Alex Morgan',
      httpStatus: 200,
    });
    assert.strictEqual(result.status, 'VERIFIED');
    assert.strictEqual(result.evidence.certificateNameMatched, true);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Apollo GraphQL Client State Extraction
  // --------------------------------------------------------------------------
  test('Extracts course and learner from window.__APOLLO_STATE__ hydration', () => {
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script>
          window.__APOLLO_STATE__ = {
            "ROOT_QUERY": {},
            "CourseCertificate:COURSERA-PY-101": {
              "__typename": "CourseCertificate",
              "id": "COURSERA-PY-101",
              "courseName": "Python for Everybody",
              "learnerName": "Alex Morgan",
              "completedAt": "2024-10-15",
              "isCompleted": true
            }
          };
        </script>
      </head>
      <body><div>Coursera Certificate</div></body>
    </html>`;

    const extracted = extractCourseraVerificationData(html, 'https://www.coursera.org/verify/COURSERA-PY-101');
    assert.strictEqual(extracted.courseTitle, 'Python for Everybody');
    assert.strictEqual(extracted.learnerName, 'Alex Morgan');

    const result = courseraAdapter({
      html,
      url: 'https://www.coursera.org/verify/COURSERA-PY-101',
      certificateId: 'COURSERA-PY-101',
      certificateName: 'Python for Everybody',
      studentName: 'Alex Morgan',
      httpStatus: 200,
    });
    assert.strictEqual(result.status, 'VERIFIED');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Open Graph & Twitter Meta Tags Extraction
  // --------------------------------------------------------------------------
  test('Extracts course and recipient from Open Graph meta tags', () => {
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="og:site_name" content="Coursera" />
        <meta property="og:title" content="Coursera | Certificate: Data Science Specialization earned by Alex Morgan" />
        <meta property="og:description" content="Coursera verified certificate awarded to Alex Morgan for completing Data Science Specialization." />
        <meta property="og:url" content="https://www.coursera.org/account/accomplishments/verify/COURSERA-DS-777" />
      </head>
      <body><div>Coursera verified certificate</div></body>
    </html>`;

    const extracted = extractCourseraVerificationData(html, 'https://www.coursera.org/verify/COURSERA-DS-777');
    assert.strictEqual(extracted.courseTitle, 'Data Science Specialization');
    assert.strictEqual(extracted.learnerName, 'Alex Morgan');

    const result = courseraAdapter({
      html,
      url: 'https://www.coursera.org/verify/COURSERA-DS-777',
      certificateId: 'COURSERA-DS-777',
      certificateName: 'Data Science Specialization',
      studentName: 'Alex Morgan',
      httpStatus: 200,
    });
    assert.strictEqual(result.status, 'VERIFIED');
    assert.strictEqual(result.evidence.certificateNameMatched, true);
  });

  // --------------------------------------------------------------------------
  // TEST 5: HTML DOM Text Accomplishment Containers
  // --------------------------------------------------------------------------
  test('Extracts accomplishment from authentic Coursera HTML DOM containers', () => {
    const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Coursera Verification</title></head>
      <body>
        <div class="accomplishment-record">
          <h1>Coursera Course Certificate</h1>
          <p>This is to certify that Alex Morgan has successfully completed the online course Machine Learning Specialization.</p>
          <div class="verification-code">Verification Code: COURSERA-ML-987654</div>
          <div>Coursera has confirmed the identity of this individual and their participation in the course.</div>
        </div>
      </body>
    </html>`;

    const result = courseraAdapter({
      html,
      url: 'https://www.coursera.org/verify/COURSERA-ML-987654',
      certificateId: 'COURSERA-ML-987654',
      certificateName: 'Machine Learning Specialization',
      studentName: 'Alex Morgan',
      httpStatus: 200,
    });
    assert.strictEqual(result.status, 'VERIFIED');
    assert.strictEqual(result.evidence.certificateIdMatched, true);
    assert.strictEqual(result.evidence.certificateNameMatched, true);
  });

  // --------------------------------------------------------------------------
  // TEST 6: Generic Unrendered SPA Marketing Fallback -> MANUAL_REVIEW
  // --------------------------------------------------------------------------
  test('Generic unrendered SPA fallback with marketing meta tags correctly produces MANUAL_REVIEW', () => {
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="og:title" content="Coursera | Online Courses &amp; Credentials From Top Educators. Join for Free | Coursera" />
        <meta property="og:description" content="Learn online and earn valuable credentials from top universities like Yale, Michigan, Stanford, and leading companies like Google and IBM." />
        <meta property="og:url" content="https://www.coursera.org/account/accomplishments/verify/2WDXU8L3S4P7" />
      </head>
      <body><div id="app"></div></body>
    </html>`;

    const result = courseraAdapter({
      html,
      url: 'https://www.coursera.org/account/accomplishments/verify/2WDXU8L3S4P7',
      certificateId: '2WDXU8L3S4P7',
      certificateName: 'Machine Learning Specialization',
      studentName: 'Alex Morgan',
      httpStatus: 200,
    });
    assert.strictEqual(result.status, 'MANUAL_REVIEW');
    assert(result.reason.includes('automated extraction was prevented') || result.reason.includes('manual review'));
  });

  // --------------------------------------------------------------------------
  // TEST 7: Anti-Bot Challenge / Login Gate -> MANUAL_REVIEW
  // --------------------------------------------------------------------------
  test('Anti-bot challenge or login gate correctly produces MANUAL_REVIEW', () => {
    const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Please log in to continue | Coursera</title></head>
      <body><div>Please log in to continue. reCAPTCHA verification required.</div></body>
    </html>`;

    const result = courseraAdapter({
      html,
      url: 'https://www.coursera.org/verify/COURSERA-ML-987654',
      certificateId: 'COURSERA-ML-987654',
      certificateName: 'Machine Learning Specialization',
      studentName: 'Alex Morgan',
      httpStatus: 200,
    });
    assert.strictEqual(result.status, 'MANUAL_REVIEW');
    assert(result.reason.includes('access challenge') || result.reason.includes('manual review'));
  });

  // --------------------------------------------------------------------------
  // TEST 8: Explicit Negative Indicator -> SUSPICIOUS
  // --------------------------------------------------------------------------
  test('Explicit "record not found" indicator produces SUSPICIOUS', () => {
    const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Coursera</title></head>
      <body><div>We couldn't find a record of this accomplishment</div></body>
    </html>`;

    const result = courseraAdapter({
      html,
      url: 'https://www.coursera.org/verify/NONEXISTENT123',
      certificateId: 'NONEXISTENT123',
      certificateName: 'Machine Learning',
      studentName: 'Alex Morgan',
      httpStatus: 200,
    });
    assert.strictEqual(result.status, 'SUSPICIOUS');
    assert(result.reason.includes('Coursera portal explicitly reported credential not found'));
  });

  // --------------------------------------------------------------------------
  // TEST 9: Credential ID Mismatch -> Fails Verification
  // --------------------------------------------------------------------------
  test('Conflicting credential ID in extracted payload prevents VERIFIED status', () => {
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "EducationalOccupationalCredential",
          "name": "Machine Learning Specialization",
          "identifier": "COURSERA-DIFFERENT-ID",
          "recipient": { "@type": "Person", "name": "Alex Morgan" }
        }
        </script>
      </head>
      <body><div>Coursera Certificate</div></body>
    </html>`;

    const result = courseraAdapter({
      html,
      url: 'https://www.coursera.org/verify/COURSERA-ML-111111',
      certificateId: 'COURSERA-ML-111111',
      certificateName: 'Machine Learning Specialization',
      studentName: 'Alex Morgan',
      httpStatus: 200,
    });
    assert.notStrictEqual(result.status, 'VERIFIED');
    assert.strictEqual(result.status, 'MANUAL_REVIEW');
  });

  // --------------------------------------------------------------------------
  // TEST 10: HTTP 200 alone with completely unrelated page is NOT VERIFIED
  // --------------------------------------------------------------------------
  test('HTTP 200 alone with empty/unrelated content produces MANUAL_REVIEW', () => {
    const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Coursera</title></head>
      <body><div>Welcome to Coursera</div></body>
    </html>`;

    const result = courseraAdapter({
      html,
      url: 'https://www.coursera.org/verify/SOME-ID',
      certificateId: 'SOME-ID',
      certificateName: 'Random Unknown Course',
      studentName: 'Random Person',
      httpStatus: 200,
    });
    assert.strictEqual(result.status, 'MANUAL_REVIEW');
  });

  console.log('\n===============================================================');
  console.log(`COURSERA EXTRACTION TEST RESULTS: ${passed}/${passed + failed} PASSED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
