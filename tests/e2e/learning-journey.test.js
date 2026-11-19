/**
 * UECOS Platform E2E Test: Core Learning Journey
 * 
 * Tests the complete user flow from signup through first lesson
 */

import assert from 'assert';
import axios from 'axios';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const client = axios.create({ baseURL: API_BASE });

let testUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'Learner'
};

let authToken = null;
let userId = null;
let subjectId = null;
let topicId = null;
let assessmentId = null;

const test = await import('node:test');

test.describe('E2E: Complete Learning Journey', () => {
  test.it('Step 1: User registers successfully', async () => {
    const response = await client.post('/api/auth/register', {
      email: testUser.email,
      password: testUser.password,
      firstName: testUser.firstName,
      lastName: testUser.lastName
    });
    
    assert.strictEqual(response.status, 201, 'Registration should return 201');
    assert.ok(response.data.user.id, 'User should have ID');
    assert.ok(response.data.learner.id, 'Learner profile should be created');
    
    userId = response.data.user.id;
  });
  
  test.it('Step 2: User logs in successfully', async () => {
    const response = await client.post('/api/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    
    assert.strictEqual(response.status, 200, 'Login should return 200');
    assert.ok(response.data.token, 'Should return JWT token');
    assert.strictEqual(response.data.user.id, userId, 'Should return correct user');
    
    authToken = response.data.token;
    client.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  });
  
  test.it('Step 3: Get available subjects', async () => {
    const response = await client.get('/api/content/subjects');
    
    assert.strictEqual(response.status, 200, 'Subjects endpoint should return 200');
    assert.ok(Array.isArray(response.data.subjects), 'Should return array of subjects');
    assert.ok(response.data.subjects.length > 0, 'Seeded subjects should be available');
    subjectId = response.data.subjects[0].id;
    const topicResponse = await client.get('/api/content/search?q=Arithmetic&type=topic');
    assert.ok(topicResponse.data.topics.length > 0, 'Seeded math topic should be searchable');
    topicId = topicResponse.data.topics[0].id;
  });
  
  test.it('Step 4: User sets learning goal', async () => {
    const response = await client.post('/api/learner/goal', {
      subjectId,
      goalDescription: 'Learn basic math'
    });
    
    assert.strictEqual(response.status, 201, 'Goal creation should return 201');
    assert.ok(response.data.path.id, 'Should create learning path');
  });
  
  test.it('Step 5: User views learning path', async () => {
    // This would use the pathId from step 4
    const response = await client.get('/api/learner/progress');
    
    assert.strictEqual(response.status, 200, 'Progress endpoint should return 200');
    assert.ok(response.data.overall, 'Should return progress data');
  });
  
  test.it('Step 6: User cannot access other user\'s data', async () => {
    const ownProgress = await client.get('/api/learner/progress');
    const attemptedOverride = await client.get('/api/learner/progress?learner_id=99999');
    assert.deepStrictEqual(
      attemptedOverride.data,
      ownProgress.data,
      'A caller-supplied learner_id must not change which learner record is returned'
    );
  });
  
  test.it('Step 7: Diagnostic questions do not reveal answer keys', async () => {
    const response = await client.post('/api/learner/assessment/diagnostic', { topicId });
    assert.strictEqual(response.status, 201);
    assessmentId = response.data.assessmentId;
    assert.equal(response.data.questions[0].correctAnswer, undefined);
    assert.equal(response.data.questions[1].correctAnswer, undefined);
  });

  test.it('Step 8: Diagnostic scoring ignores client correctness flags', async () => {
    const response = await client.post(`/api/learner/assessment/${assessmentId}/submit`, {
      responses: [
        { questionId: 1, answer: '3', isCorrect: true },
        { questionId: 2, answer: '5', isCorrect: false }
      ]
    });
    assert.equal(response.status, 200);
    assert.equal(response.data.score, 50);
  });

  test.it('Step 9: Completed assessments cannot be submitted again', async () => {
    try {
      await client.post(`/api/learner/assessment/${assessmentId}/submit`, {
        responses: [
          { questionId: 1, answer: '4' },
          { questionId: 2, answer: '5' }
        ]
      });
      assert.fail('A completed assessment must not be resubmittable');
    } catch (error) {
      assert.equal(error.response.status, 404);
    }
  });

  test.it('Step 10: Logout revokes the existing token', async () => {
    const response = await client.post('/api/auth/logout');
    assert.strictEqual(response.status, 200, 'Logout should return 200');

    try {
      await client.get('/api/auth/me');
      assert.fail('The old access token must stop working immediately after logout');
    } catch (error) {
      assert.equal(error.response.status, 401);
    }
    delete client.defaults.headers.common['Authorization'];
  });

  test.it('Step 11: Subsequent requests without token fail', async () => {
    try {
      await client.get('/api/learner/dashboard');
      assert.fail('Should not allow unauthenticated access');
    } catch (error) {
      assert.strictEqual(error.response.status, 401, 'Should return 401 Unauthorized');
    }
  });
});
