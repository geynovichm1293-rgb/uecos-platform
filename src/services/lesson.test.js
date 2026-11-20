import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeQuestion, sanitizeLessonContent } from './lesson.js';

test('grades a text answer using the server-side answer key', () => {
  const result = gradeQuestion({ id: 1, correctAnswer: 'Photosynthesis', explanation: 'Plants convert light energy.' }, ' photosynthesis ');
  assert.equal(result.isCorrect, true);
  assert.equal(result.correctAnswer, null);
  assert.equal(result.explanation, 'Plants convert light energy.');
});

test('accepts configured alternate answers', () => {
  const result = gradeQuestion({ id: 2, acceptedAnswers: ['colour', 'color'] }, 'COLOR');
  assert.equal(result.isCorrect, true);
});

test('grades a multiple-choice option ID without trusting client correctness flags', () => {
  const result = gradeQuestion({ id: 3, correctOptionId: 'b' }, 'b');
  assert.equal(result.isCorrect, true);
});

test('returns the stored answer only after an incorrect attempt', () => {
  const result = gradeQuestion({ id: 4, correctAnswer: '42' }, '41');
  assert.equal(result.isCorrect, false);
  assert.equal(result.correctAnswer, '42');
});

test('rejects questions without a configured server-side answer key', () => {
  assert.throws(
    () => gradeQuestion({ id: 5, prompt: 'Unconfigured question' }, 'anything'),
    error => error.status === 422
  );
});

test('removes answer keys and correctness flags from lesson content', () => {
  const source = {
    title: 'Test',
    questions: [{
      id: 1,
      prompt: '2 + 2?',
      correctAnswer: '4',
      correctOptionId: 'b',
      acceptedAnswers: ['4'],
      options: [{ id: 'a', text: '3', isCorrect: false }, { id: 'b', text: '4', isCorrect: true }]
    }]
  };
  const safe = sanitizeLessonContent(source);
  assert.equal(safe.questions[0].correctAnswer, undefined);
  assert.equal(safe.questions[0].correctOptionId, undefined);
  assert.equal(safe.questions[0].acceptedAnswers, undefined);
  assert.equal(safe.questions[0].options[1].isCorrect, undefined);
  assert.equal(source.questions[0].correctAnswer, '4');
  const nested = sanitizeLessonContent({ sections: [{ questions: [{ id: 2, correctAnswer: 'secret' }] }] });
  assert.equal(nested.sections[0].questions[0].correctAnswer, undefined);
});
