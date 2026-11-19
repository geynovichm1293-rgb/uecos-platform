import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './validation.js';

function runValidation(schema, body) {
  const req = { body };
  let statusCode = null;
  let responseBody = null;
  let nextCalled = false;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { responseBody = payload; return this; }
  };
  validate(schema)(req, res, () => { nextCalled = true; });
  return { req, statusCode, responseBody, nextCalled };
}

test('normalizes email addresses before account processing', () => {
  const result = runValidation('register', {
    email: '  STUDENT@EXAMPLE.COM  ',
    password: 'a-secure-password'
  });
  assert.equal(result.nextCalled, true);
  assert.equal(result.req.body.email, 'student@example.com');
});

test('rejects passwords exceeding bcrypt UTF-8 byte limit', () => {
  const result = runValidation('register', {
    email: 'student@example.com',
    password: '😀'.repeat(20)
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
});

test('strips client-provided correctness flags from assessment responses', () => {
  const result = runValidation('assessmentResponses', {
    responses: [{ questionId: 1, answer: '4', isCorrect: true }]
  });
  assert.equal(result.nextCalled, true);
  assert.equal(result.req.body.responses[0].isCorrect, undefined);
});

test('rejects invalid subject age ranges', () => {
  const result = runValidation('subject', {
    name: 'Mathematics',
    ageRangeMin: 18,
    ageRangeMax: 5
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
});

test('rejects unknown diagnostic fields and invalid topic IDs', () => {
  const result = runValidation('diagnostic', {
    topicId: -1,
    learnerId: 123
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
});
