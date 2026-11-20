import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeQuestion } from '../src/services/lesson.js';
import { gradeAssessmentResponses } from '../src/services/assessment.js';

test('lesson grading rejects empty or blank answer keys', () => {
  for (const question of [
    { id: 1, correctAnswer: '' },
    { id: 2, acceptedAnswers: [] },
    { id: 3, acceptedAnswers: ['   '] }
  ]) {
    assert.throws(
      () => gradeQuestion(question, ''),
      error => error.status === 422
    );
  }
});

test('assessment grading rejects empty or blank answer keys', () => {
  for (const questions of [
    [{ id: 1, correctAnswer: '' }],
    [{ id: 1, acceptedAnswers: [] }],
    [{ id: 1, acceptedAnswers: ['   '] }]
  ]) {
    assert.throws(
      () => gradeAssessmentResponses(questions, [{ questionId: 1, answer: '' }]),
      error => error.status === 422
    );
  }
});

test('lesson and assessment grading accept configured answer keys', () => {
  assert.equal(gradeQuestion({ id: 1, correctAnswer: '12' }, '12').isCorrect, true);
  assert.equal(
    gradeAssessmentResponses(
      [{ id: 1, correctAnswer: '12' }],
      [{ questionId: 1, answer: '12' }]
    ).score,
    100
  );
});
