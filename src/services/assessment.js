import { getPool } from '../db/init.js';
import { logger } from '../utils/logger.js';

/**
 * Create assessment for learner to diagnose current level
 */
export async function createDiagnosticAssessment(learnerId, topicId, questions) {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      `INSERT INTO assessments (learner_id, topic_id, questions, assessment_type, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [learnerId, topicId, JSON.stringify(questions), 'diagnostic', 'in_progress']
    );
    
    logger.info('📊 Diagnostic assessment created', { learnerId, topicId });
    return result.rows[0];
  } catch (error) {
    logger.error('❌ Assessment creation failed', { error: error.message });
    throw error;
  }
}

/**
 * Submit assessment responses
 */
export async function submitAssessment(assessmentId, responses) {
  const pool = getPool();
  
  try {
    // Calculate score
    const score = calculateScore(responses);
    
    const result = await pool.query(
      `UPDATE assessments 
       SET responses = $1, score = $2, status = $3, completed_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [JSON.stringify(responses), score, 'completed', assessmentId]
    );
    
    logger.info('✅ Assessment submitted', { assessmentId, score });
    return result.rows[0];
  } catch (error) {
    logger.error('❌ Assessment submission failed', { error: error.message });
    throw error;
  }
}

/**
 * Get assessment details
 */
export async function getAssessment(assessmentId) {
  const pool = getPool();
  
  const result = await pool.query(
    'SELECT * FROM assessments WHERE id = $1',
    [assessmentId]
  );
  
  return result.rows[0] || null;
}

/**
 * Calculate score from responses
 */
function calculateScore(responses) {
  if (!responses || responses.length === 0) return 0;
  
  const correctCount = responses.filter(r => r.isCorrect).length;
  return Math.round((correctCount / responses.length) * 100);
}

/**
 * Determine starting level based on assessment score
 */
export function determineStartingLevel(score) {
  if (score >= 80) return 'LIKELY_MASTERED';
  if (score >= 60) return 'PRACTICING';
  if (score >= 40) return 'DEVELOPING';
  if (score >= 20) return 'INTRODUCED';
  return 'NOT_ASSESSED';
}
