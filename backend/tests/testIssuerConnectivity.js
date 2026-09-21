/**
 * ==============================================================================
 * OPTIONAL LIVE ISSUER CONNECTIVITY TEST
 * File: backend/tests/testIssuerConnectivity.js
 * 
 * IMPORTANT:
 * - Read-only network check.
 * - Does NOT insert or alter database records.
 * - Does NOT claim any certificate is valid.
 * - Connectivity IS NOT authenticity.
 * ==============================================================================
 */

const https = require('https');

const ENDPOINTS = [
  { name: 'NPTEL Official Portal', host: 'nptel.ac.in', path: '/' },
  { name: 'NPTEL Archive Portal', host: 'archive.nptel.ac.in', path: '/' },
  { name: 'Coursera Verification Host', host: 'www.coursera.org', path: '/' },
  { name: 'edX Verification Host', host: 'verify.edx.org', path: '/' },
  { name: 'Credly Portal', host: 'www.credly.com', path: '/' },
  { name: 'Accredible Portal', host: 'credential.net', path: '/' },
];

function checkHost(endpoint) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.request(
      {
        host: endpoint.host,
        path: endpoint.path,
        method: 'HEAD',
        timeout: 5000,
        headers: {
          'User-Agent': 'StudentCredentialEngine-ConnectivityCheck/1.0',
        },
      },
      (res) => {
        resolve({
          name: endpoint.name,
          host: endpoint.host,
          reachable: true,
          httpStatus: res.statusCode,
          latencyMs: Date.now() - start,
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: endpoint.name,
        host: endpoint.host,
        reachable: false,
        reason: 'Connection timed out (5s)',
        latencyMs: Date.now() - start,
      });
    });

    req.on('error', (err) => {
      resolve({
        name: endpoint.name,
        host: endpoint.host,
        reachable: false,
        reason: err.message,
        latencyMs: Date.now() - start,
      });
    });

    req.end();
  });
}

async function runConnectivityReport() {
  console.log('===============================================================');
  console.log('PUBLIC ISSUER CONNECTIVITY REPORT (READ-ONLY)');
  console.log('Notice: Reachability/Connectivity does NOT confer authenticity.');
  console.log('===============================================================\n');

  for (const ep of ENDPOINTS) {
    const res = await checkHost(ep);
    if (res.reachable) {
      console.log(`[REACHABLE] ${res.name} (${res.host}) - HTTP ${res.httpStatus} (${res.latencyMs}ms)`);
    } else {
      console.log(`[UNREACHABLE] ${res.name} (${res.host}) - ${res.reason} (${res.latencyMs}ms)`);
    }
  }

  console.log('\nConnectivity report complete. Zero database mutations.');
}

if (require.main === module) {
  runConnectivityReport();
}

module.exports = { runConnectivityReport };
