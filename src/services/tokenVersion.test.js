import test from 'node:test';
import assert from 'node:assert/strict';
import { isTokenVersionCurrent } from './tokenVersion.js';

test('accepts matching current token versions', () => {
  assert.equal(isTokenVersionCurrent(3, 3), true);
});

test('treats pre-migration tokens as version zero', () => {
  assert.equal(isTokenVersionCurrent(undefined, 0), true);
});

test('rejects tokens issued before a logout version bump', () => {
  assert.equal(isTokenVersionCurrent(0, 1), false);
});

test('rejects malformed token versions', () => {
  assert.equal(isTokenVersionCurrent('1', 1), false);
});
