import test from 'node:test';
import assert from 'node:assert/strict';
import { securityHeaders } from './securityHeaders.js';

test('securityHeaders sets restrictive headers and continues the request', () => {
  const headers = new Map();
  let nextCalled = false;
  const res = {
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    }
  };

  securityHeaders({}, res, () => {
    nextCalled = true;
  });

  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('permissions-policy'), 'camera=(), microphone=(self), geolocation=()');
  assert.equal(
    headers.get('content-security-policy'),
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'"
  );
  assert.equal(nextCalled, true);
});

test('adds HSTS only when the request is secure', () => {
  const secureRes = createResponse();
  securityHeaders({ secure: true }, secureRes, () => {});
  assert.equal(secureRes.headers['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains');

  const plainRes = createResponse();
  securityHeaders({ secure: false }, plainRes, () => {});
  assert.equal(plainRes.headers['Strict-Transport-Security'], undefined);
});
