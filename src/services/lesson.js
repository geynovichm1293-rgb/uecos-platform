import { getPool } from '../db/init.js';
import { logger } from '../utils/logger.js';

/**
 * Get lesson with all content
 */
export async function getLesson(lessonId, learnerId) {
  const pool = getPool();
  
  try {
    // Get lesson
    const lessonResult = await pool.query(
      'SELECT * FROM lessons WHERE id = $1',
      [lessonId]
    );
    
    if (lessonResult.rows.length === 0) {
      throw new Error('Lesson not found');
    }
    
    const lesson = lessonResult.rows[0];
    
    // Get learner's progress on this lesson
    const progressResult = await pool.query(
      'SELECT * FROM progress WHERE lesson_id = $1 AND learner_id = $2',
      [lessonId, learnerId]
    );
    
    const progress = progressResult.rows[0] || null;
    
    logger.info('📖 Lesson loaded', { lessonId, learnerId });
    
    return {
      lesson,
      progress,
      content: lesson.content ? JSON.parse(lesson.content) : null
    };
  } catch (error) {
    logger.error('❌ Lesson fetch failed', { error: error.message });
    throw error;
  }
}

/**
 * Update learner progress on lesson
 */
export async function updateProgress(lessonId, learnerId, status, completionPercentage) {
  const pool = getPool();
  
  try {
    // Upsert progress
    const result = await pool.query(
      `INSERT INTO progress (lesson_id, learner_id, status, completion_percentage, attempts)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (lesson_id, learner_id)
       DO UPDATE SET status = $3, completion_percentage = $4, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [lessonId, learnerId, status, completionPercentage]
    );
    
    logger.info('✅ Progress updated', { lessonId, learnerId, status });
    return result.rows[0];
  } catch (error) {
    logger.error('❌ Progress update failed', { error: error.message });
    throw error;
  }
}

/**
 * Complete lesson (mark as completed)
 */
export async function completeLesson(lessonId, learnerId) {
  return updateProgress(lessonId, learnerId, 'completed', 100);
}

/**
 * Get lesson feedback based on answer
 */
export async function generateFeedback(question, userAnswer, correctAnswer) {
  try {
    // Basic feedback logic (AI integration future)
    const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
    
    const feedback = {
      isCorrect,
      message: isCorrect
        ? '🎉 Great job! That\'s correct.'
        : '💭 Not quite. Let\'s try again or review the concept.',
      explanation: question.explanation || null,
      correctAnswer: !isCorrect ? correctAnswer : null
    };
    
    logger.info('📝 Feedback generated', { isCorrect });
    return feedback;
  } catch (error) {
    logger.error('❌ Feedback generation failed', { error: error.message });
    throw error;
  }
}

function normalizeAnswer(answer) {
  return String(answer).toLowerCase().trim();
}
