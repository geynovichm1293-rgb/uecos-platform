import { getPool } from '../db/init.js';
import { logger } from '../utils/logger.js';

/**
 * Get next recommended lesson for learner
 */
export async function getNextRecommendation(learnerId, subjectId) {
  const pool = getPool();
  
  try {
    // Get learner's current progress level
    const progressResult = await pool.query(
      `SELECT AVG(CAST(completion_percentage AS FLOAT)) as avg_completion
       FROM progress p
       JOIN lessons l ON p.lesson_id = l.id
       WHERE p.learner_id = $1`,
      [learnerId]
    );
    
    const avgCompletion = progressResult.rows[0]?.avg_completion || 0;
    
    // Recommend next uncompleted lesson
    const recommendationResult = await pool.query(
      `SELECT l.id, l.title, l.description, l.difficulty_level, t.name as topic_name
       FROM lessons l
       JOIN skills s ON l.skill_id = s.id
       JOIN topics t ON s.topic_id = t.id
       LEFT JOIN progress p ON l.id = p.lesson_id AND p.learner_id = $1
       WHERE t.subject_id = $2 AND (p.id IS NULL OR p.status != 'completed')
       ORDER BY t.id, s.difficulty_level
       LIMIT 1`,
      [learnerId, subjectId]
    );
    
    const recommendation = recommendationResult.rows[0];
    
    if (recommendation) {
      logger.info('💡 Recommendation generated', {
        learnerId,
        lessonId: recommendation.id,
        topic: recommendation.topic_name
      });
    }
    
    return recommendation;
  } catch (error) {
    logger.error('❌ Recommendation generation failed', { error: error.message });
    throw error;
  }
}
