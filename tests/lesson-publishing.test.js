import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLessonForPublishing } from '../src/services/lesson.js';

test('lesson publishing rejects missing or malformed question content', () => {
  assert.deepEqual(validateLessonForPublishing(null), ['Lesson content must be an object']);
  assert.deepEqual(validateLessonForPublishing({ sections: [] }), [
    'A publishable lesson must include at least one graded question'
  ]);
});

test('lesson publishing accepts a complete server-graded question', () => {
  const errors = validateLessonForPublishing({
    questions: [{
      id: 'q1',
      prompt: 'What is 2 + 2?',
      correctAnswer: '4',
      explanation: 'Add two and two to get four.'
    }]
  });
  assert.deepEqual(errors, []);
});

test('lesson publishing rejects duplicate IDs, missing keys, weak prompts, and missing explanations', () => {
  const errors = validateLessonForPublishing({
    questions: [
      { id: 1, prompt: 'Hi', explanation: 'Short', correctAnswer: 'yes' },
      { id: 1, prompt: 'What is the answer?', explanation: '', correctAnswer: null }
    ]
  });
  assert.ok(errors.some(error => error.includes('id must be unique')));
  assert.ok(errors.some(error => error.includes('meaningful prompt')));
  assert.ok(errors.some(error => error.includes('server-side answer key')));
  assert.ok(errors.some(error => error.includes('needs an explanation')));
});

test('lesson publishing accepts a non-empty acceptedAnswers key list', () => {
  const errors = validateLessonForPublishing({
    questions: [{
      id: 2,
      text: 'Choose the correct answer.',
      acceptedAnswers: ['A', 'a'],
      explanation: 'Option A is supported by the lesson.'
    }]
  });
  assert.deepEqual(errors, []);
});
