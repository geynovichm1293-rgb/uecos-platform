import assert from 'assert';
import { generateFeedback } from '../services/lesson.js';

const test = await import('node:test');

test.describe('Lesson Service', () => {
  test.it('should provide positive feedback for correct answers', async () => {
    const question = { explanation: 'Great work!' };
    const feedback = await generateFeedback(question, 'correct', 'correct');
    
    assert.strictEqual(feedback.isCorrect, true, 'Should mark as correct');
    assert.ok(feedback.message.includes('correct'), 'Should have success message');
  });
  
  test.it('should provide corrective feedback for wrong answers', async () => {
    const question = { explanation: 'Review this concept' };
    const feedback = await generateFeedback(question, 'wrong', 'correct');
    
    assert.strictEqual(feedback.isCorrect, false, 'Should mark as incorrect');
    assert.ok(feedback.correctAnswer === 'correct', 'Should provide correct answer');
  });
  
  test.it('should normalize answers for comparison', async () => {
    const question = { explanation: 'Test' };
    const feedback = await generateFeedback(question, '  HELLO  ', 'hello');
    
    assert.strictEqual(feedback.isCorrect, true, 'Should normalize case and whitespace');
  });
});
