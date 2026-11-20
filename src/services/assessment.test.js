import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeAssessmentResponses, sanitizeAssessmentQuestions } from './assessment.js';

const questions = [
  { id: 1, text: '2 + 2?', correctAnswer: '4' },
  { id: 2, text: 'Choose the blue option', correctOptionId: 'blue' }
];

test('grades assessment responses using stored answer keys, not client isCorrect flags', () => {
  const result = gradeAssessmentResponses(questions, [
    { questionId: 1, answer: '4', isCorrect: false },
    { questionId: 2, answer: 'red', isCorrect: true }
  ]);
  assert.equal(result.score, 50);
  assert.equal(result.responses[0].isCorrect, true);
  assert.equal(result.responses[1].isCorrect, false);
});

test('accepts alternate answers configured by the server', () => {
  const result = gradeAssessmentResponses(
    [{ id: 1, acceptedAnswers: ['colour', 'color'] }],
    [{ questionId: 1, answer: 'COLOR' }]
  );
  assert.equal(result.score, 100);
});

test('requires exactly one response for each question', () => {
  assert.throws(
    () => gradeAssessmentResponses(questions, [{ questionId: 1, answer: '4' }]),
    error => error.status === 400
  );
});

test('rejects unknown and duplicate question IDs', () => {
  assert.throws(
    () => gradeAssessmentResponses(questions, [
      { questionId: 1, answer: '4' },
      { questionId: 1, answer: '4' }
    ]),
    error => error.status === 400
  );
});

test('rejects assessments containing questions without answer keys', () => {
  assert.throws(
    () => gradeAssessmentResponses([{ id: 1, text: 'No key' }], [{ questionId: 1, answer: 'anything' }]),
    error => error.status === 422
  );
});

test('removes answer keys from diagnostic questions returned to learners', () => {
  const safe = sanitizeAssessmentQuestions(questions);
  assert.equal(safe[0].correctAnswer, undefined);
  assert.equal(safe[1].correctOptionId, undefined);
  assert.equal(questions[0].correctAnswer, '4');
});
