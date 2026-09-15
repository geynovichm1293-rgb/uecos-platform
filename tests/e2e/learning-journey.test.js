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
  });
  
  test.it('Step 4: User sets learning goal', async () => {
    // Assuming a subject with ID 1 exists
    const response = await client.post('/api/learner/goal', {
      subjectId: 1,
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
    try {
      await client.get('/api/learner/progress?learner_id=99999');
      assert.fail('Should not allow access to other user data');
    } catch (error) {
      assert.strictEqual(error.response.status, 403, 'Should return 403 Forbidden');
    }
  });
  
  test.it('Step 7: Logout clears token', async () => {
    const response = await client.post('/api/auth/logout');
    
    assert.strictEqual(response.status, 200, 'Logout should return 200');
    
    // Remove token for next requests
    delete client.defaults.headers.common['Authorization'];
  });
  
  test.it('Step 8: Subsequent requests without token fail', async () => {
    try {
      await client.get('/api/learner/dashboard');
      assert.fail('Should not allow unauthenticated access');
    } catch (error) {
      assert.strictEqual(error.response.status, 401, 'Should return 401 Unauthorized');
    }
  });
});
