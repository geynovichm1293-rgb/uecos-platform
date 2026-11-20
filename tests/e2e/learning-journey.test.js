/**
 * UECOS Platform E2E Test: Core Learning Journey
 * 
 * Tests the complete user flow from signup through first lesson
 */

import assert from 'assert';
import axios from 'axios';
import pg from 'pg';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const client = axios.create({ baseURL: API_BASE });
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

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
let diagnosticQuestionIds = [];
let lessonId = null;
let pathId = null;

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

  test.it('Step 1b: Email uniqueness is case-insensitive', async () => {
    try {
      await client.post('/api/auth/register', {
        email: testUser.email.toUpperCase(),
        password: testUser.password
      });
      assert.fail('A case-variant duplicate email must not create another account');
    } catch (error) {
      assert.equal(error.response.status, 409);
    }
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
    subjectId = response.data.subjects.find(subject => subject.name === 'Mathematics')?.id;
    assert.ok(subjectId, 'Mathematics subject should be available');
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
    pathId = response.data.path.id;

    // Create a published lesson fixture so the learner lesson endpoints are exercised.
    const skill = await testPool.query(
      `INSERT INTO skills (topic_id, name, difficulty_level, status)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [topicId, 'E2E lesson access skill', 'beginner', 'published']
    );
    const lesson = await testPool.query(
      `INSERT INTO lessons (skill_id, title, description, content, duration_minutes, status)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING id`,
      [skill.rows[0].id, 'E2E lesson access test', 'Test lesson', JSON.stringify({
        questions: [{ id: 101, prompt: 'What is 2 + 2?', correctAnswer: '4', explanation: 'Add two and two.' }]
      }), 5, 'published']
    );
    lessonId = lesson.rows[0].id;
  });

  test.it('Step 4a: Seeded arithmetic lesson is published, sanitized, and server-graded', async () => {
    const seeded = await testPool.query(
      `SELECT l.id
       FROM lessons l
       JOIN skills s ON s.id = l.skill_id
       JOIN topics t ON t.id = s.topic_id
       WHERE t.name = 'Arithmetic Fundamentals'
         AND l.title = 'Addition and Subtraction: Combining and Comparing Quantities'
         AND l.status = 'published'
       LIMIT 1`
    );
    assert.equal(seeded.rows.length, 1, 'The validated arithmetic lesson should be seeded');
    const lessonIdFromSeed = seeded.rows[0].id;
    const lesson = await client.get(`/api/learner/lesson/${lessonIdFromSeed}`);
    assert.equal(lesson.status, 200);
    assert.equal(lesson.data.content.questions.length, 20);
    assert.equal(lesson.data.content.questions[0].correctAnswer, undefined);

    const answer = await client.post(`/api/learner/lesson/${lessonIdFromSeed}/answer`, {
      questionId: 'arith-add-01',
      answer: '12'
    });
    assert.equal(answer.status, 200);
    assert.equal(answer.data.feedback.isCorrect, true);
    await client.post(`/api/learner/lesson/${lessonIdFromSeed}/complete`);
  });

  test.it('Step 4b: Learner can load and answer a lesson in their active path', async () => {
    const lesson = await client.get(`/api/learner/lesson/${lessonId}`);
    assert.equal(lesson.status, 200);
    assert.equal(lesson.data.content.questions[0].correctAnswer, undefined);

    const answer = await client.post(`/api/learner/lesson/${lessonId}/answer`, {
      questionId: 101,
      answer: '4'
    });
    assert.equal(answer.status, 200);
    assert.equal(answer.data.feedback.isCorrect, true);

    const completed = await client.post(`/api/learner/lesson/${lessonId}/complete`);
    assert.equal(completed.status, 200);
    assert.equal(completed.data.status, 'completed');
  });

  test.it('Step 4c: A different learner cannot load, answer, or complete that lesson', async () => {
    const otherEmail = `other-${Date.now()}@example.com`;
    await client.post('/api/auth/register', { email: otherEmail, password: 'OtherPassword123!' });
    const otherLogin = await client.post('/api/auth/login', { email: otherEmail, password: 'OtherPassword123!' });
    client.defaults.headers.common['Authorization'] = `Bearer ${otherLogin.data.token}`;

    for (const action of [
      () => client.get(`/api/learner/lesson/${lessonId}`),
      () => client.post(`/api/learner/lesson/${lessonId}/answer`, { questionId: 101, answer: '4' }),
      () => client.post(`/api/learner/lesson/${lessonId}/complete`)
    ]) {
      try {
        await action();
        assert.fail('A learner without an active path must not access this lesson');
      } catch (error) {
        assert.equal(error.response.status, 404);
      }
    }

    try {
      await client.post('/api/learner/assessment/diagnostic', { topicId });
      assert.fail('A learner without an active path must not start a diagnostic');
    } catch (error) {
      assert.equal(error.response.status, 409);
    }

    client.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  });
  
  test.it('Step 4d: A learner has only one active path per subject', async () => {
    const response = await client.post('/api/learner/goal', {
      subjectId,
      goalDescription: 'Refresh my basic math learning path'
    });
    assert.equal(response.status, 201);
    assert.notEqual(response.data.path.id, pathId);

    const paths = await testPool.query(
      `SELECT id, status FROM learning_paths
       WHERE learner_id = (SELECT id FROM learners WHERE user_id = $1)
         AND subject_id = $2
       ORDER BY id`,
      [userId, subjectId]
    );
    assert.equal(paths.rows.filter(path => path.status === 'active').length, 1);
    assert.equal(paths.rows.find(path => path.id === pathId).status, 'superseded');
  });

  test.it('Step 4e: A learner cannot create a path for an unpublished or missing subject', async () => {
    try {
      await client.post('/api/learner/goal', {
        subjectId: 99999999,
        goalDescription: 'Invalid subject test'
      });
      assert.fail('A missing subject must not create a learning path');
    } catch (error) {
      assert.equal(error.response.status, 404);
    }
  });

  test.it('Step 4f: Concurrent path replacements preserve the single-active-path rule', async () => {
    const results = await Promise.all([
      client.post('/api/learner/goal', { subjectId, goalDescription: 'Concurrent path request one' }),
      client.post('/api/learner/goal', { subjectId, goalDescription: 'Concurrent path request two' })
    ]);
    assert.equal(results[0].status, 201);
    assert.equal(results[1].status, 201);

    const active = await testPool.query(
      `SELECT COUNT(*)::integer AS count
       FROM learning_paths
       WHERE learner_id = (SELECT id FROM learners WHERE user_id = $1)
         AND subject_id = $2
         AND status = 'active'`,
      [userId, subjectId]
    );
    assert.equal(active.rows[0].count, 1);
  });

  test.it('Step 5: User views learning path', async () => {
    // This would use the pathId from step 4
    const response = await client.get('/api/learner/progress');
    
    assert.strictEqual(response.status, 200, 'Progress endpoint should return 200');
    assert.ok(response.data.overall, 'Should return progress data');
  });
  
  test.it('Step 5b: Progress filters reject invalid subjects and hide inactive-path skill data', async () => {
    try {
      await client.get('/api/learner/progress?subjectId=not-a-number');
      assert.fail('Invalid subject IDs must be rejected');
    } catch (error) {
      assert.equal(error.response.status, 400);
    }

    const subjects = await client.get('/api/content/subjects');
    const inactiveSubject = subjects.data.subjects.find(subject => subject.name === 'Science');
    assert.ok(inactiveSubject, 'Science subject should be seeded');
    const response = await client.get(`/api/learner/progress?subjectId=${inactiveSubject.id}`);
    assert.equal(response.status, 200);
    assert.deepStrictEqual(response.data.bySkill, []);
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
    assert.equal(response.data.questions.length, 10);
    assert.equal(response.data.questions[0].correctAnswer, undefined);
    assert.equal(response.data.questions[1].correctAnswer, undefined);
    diagnosticQuestionIds = response.data.questions.map(question => question.id);
    assert.ok(diagnosticQuestionIds.every(id => typeof id === 'string'));
  });

  test.it('Step 8: Diagnostic scoring ignores client correctness flags', async () => {
    const responses = diagnosticQuestionIds.map((questionId, index) => ({
      questionId,
      answer: index === 0 ? '12' : 'not-the-answer',
      // Deliberately lie in both directions; the server must grade the submitted answer.
      isCorrect: index !== 0
    }));
    const response = await client.post(`/api/learner/assessment/${assessmentId}/submit`, { responses });
    assert.equal(response.status, 200);
    assert.equal(response.data.score, 10);
  });

  test.it('Step 9: Completed assessments cannot be submitted again', async () => {
    try {
      await client.post(`/api/learner/assessment/${assessmentId}/submit`, {
        responses: diagnosticQuestionIds.map(questionId => ({ questionId, answer: '0' }))
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


test.after(async () => {
  await testPool.end();
});
